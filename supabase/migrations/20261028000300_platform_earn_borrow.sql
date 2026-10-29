-- Earn and Borrow run on the platform (owner's decision, 2026-10-28): no yield or lending provider is contracted,
-- so nothing waits for one. Earn allocations and withdrawals are instant and the platform pays rewards daily at the
-- advertised rate, net of its fee, out of revenue. Loans: Compliance approves (collateral locks at once), staff pay
-- the loan by bank transfer and mark it funded, interest accrues daily, bank repayments are confirmed by staff,
-- repaying by selling collateral is instant at the live price, and at 80% LTV the platform sells collateral itself.
-- The provider webhooks remain for when providers are contracted.

-- Journal rules: platform-paid rewards and collateral sold on the platform. Mirrors packages/ledger/src/journal.ts.
create or replace function public.journal_lines_for(p_tx public.transactions, p_to text) returns jsonb
language plpgsql stable as $$
declare
  c text := p_tx.customer_id::text;
  a text := p_tx.asset;
  amt bigint := p_tx.amount_drops;
  fee bigint := p_tx.fee_drops;
  via_suspense boolean := coalesce((p_tx.meta->>'via_suspense')::boolean, false);
begin
  case p_tx.kind::text || ':' || p_to
    when 'deposit:credited' then
      return jsonb_build_array(public.jl(null, case when via_suspense then 'suspense' else 'omnibus' end, amt, a), public.jl(c, 'available', -amt, a));
    when 'deposit:no_tag' then
      return jsonb_build_array(public.jl(null, 'omnibus', amt, a), public.jl(null, 'suspense', -amt, a));
    when 'withdrawal:requested' then
      return jsonb_build_array(public.jl(c, 'available', amt, a), public.jl(c, 'reserved', -amt, a));
    when 'withdrawal:validated' then
      return jsonb_build_array(public.jl(c, 'reserved', amt, a), public.jl(null, 'omnibus', -(amt - fee), a), public.jl(null, 'fee_revenue', -fee, a));
    when 'withdrawal:rejected', 'withdrawal:failed', 'withdrawal:cancelled' then
      return jsonb_build_array(public.jl(c, 'reserved', amt, a), public.jl(c, 'available', -amt, a));
    when 'exchange:accepted' then
      return jsonb_build_array(public.jl(c, 'available', amt, a), public.jl(c, 'reserved', -amt, a));
    when 'exchange:sold' then
      return jsonb_build_array(public.jl(c, 'reserved', amt, a), public.jl(null, 'omnibus', -amt, a));
    when 'exchange:paid_out' then
      -- A swap delivers the bought asset from the omnibus; a USD payout leaves the ledger through the bank.
      if p_tx.counter_asset is null or p_tx.counter_amount is null then return '[]'::jsonb; end if;
      return jsonb_build_array(public.jl(null, 'omnibus', p_tx.counter_amount, p_tx.counter_asset), public.jl(c, 'available', -p_tx.counter_amount, p_tx.counter_asset));
    when 'yield_allocate:requested' then
      return jsonb_build_array(public.jl(c, 'available', amt, a), public.jl(c, 'pending_yield', -amt, a));
    when 'yield_allocate:confirmed' then
      return jsonb_build_array(public.jl(c, 'pending_yield', amt, a), public.jl(c, 'yield', -amt, a));
    when 'yield_allocate:provider_failed' then
      return jsonb_build_array(public.jl(c, 'pending_yield', amt, a), public.jl(c, 'available', -amt, a));
    when 'yield_redeem:confirmed' then
      return jsonb_build_array(public.jl(c, 'yield', amt, a), public.jl(c, 'available', -amt, a));
    when 'yield_reward:credited' then
      -- Platform-paid rewards come out of the platform's revenue; provider statements are owed by the provider.
      if p_tx.meta->>'source' = 'platform' then
        return jsonb_build_array(public.jl(null, 'fee_revenue', amt - fee, a), public.jl(c, 'available', -(amt - fee), a));
      end if;
      return jsonb_build_array(public.jl(null, 'provider_receivable', amt, a), public.jl(c, 'available', -(amt - fee), a), public.jl(null, 'fee_revenue', -fee, a));
    when 'loan:collateral_locked' then
      return jsonb_build_array(public.jl(c, 'available', amt, a), public.jl(c, 'collateral', -amt, a));
    when 'loan_collateral:recorded' then
      return jsonb_build_array(public.jl(c, 'available', amt, a), public.jl(c, 'reserved', -amt, a));
    when 'loan_collateral:lock_confirmed' then
      return jsonb_build_array(public.jl(c, 'reserved', amt, a), public.jl(c, 'collateral', -amt, a));
    when 'loan_collateral:failed' then
      return jsonb_build_array(public.jl(c, 'reserved', amt, a), public.jl(c, 'available', -amt, a));
    when 'loan_repay:received' then
      -- Collateral sold by the platform (customer's choice, or liquidation) moves to the platform wallet.
      if p_tx.meta->>'via' in ('sell', 'liquidation') then
        return jsonb_build_array(public.jl(c, 'collateral', amt, a), public.jl(null, 'omnibus', -amt, a));
      end if;
      return '[]'::jsonb;
    when 'loan:repaid' then
      if coalesce(amt, 0) = 0 then return '[]'::jsonb; end if; -- all collateral was sold
      return jsonb_build_array(public.jl(c, 'collateral', amt, a), public.jl(c, 'available', -amt, a));
    else
      return '[]'::jsonb;
  end case;
end $$;
-- ───────── Earn: allocations and withdrawals are instant; the platform pays rewards ─────────

-- Pays one position its rewards since they were last paid: gross at the asset's APR, less the platform fee, out of
-- platform revenue. Returns the net amount credited (0 when nothing is due yet, and the accrual keeps running).
create or replace function public.yield_pay(p_customer uuid, p_asset text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  y yield_positions;
  t transactions;
  gross bigint;
  fee bigint;
begin
  select * into y from yield_positions where customer_id = p_customer and product = lower(p_asset) || '_flexible' for update;
  if not found then return 0; end if;
  if y.allocated_drops = 0 then
    update yield_positions set rate_updated_at = now(), estimated_accrued_drops = 0 where customer_id = y.customer_id and product = y.product;
    return 0;
  end if;
  gross := floor(y.allocated_drops::numeric * y.apr_bps * extract(epoch from now() - y.rate_updated_at) / (10000::numeric * 365 * 86400));
  fee := (gross * y.fee_bps + 5000) / 10000;
  if gross - fee <= 0 then return 0; end if;
  t := public.create_tx(p_customer, 'yield_reward', public.next_ref('YLD'), 'statement_received', gross, 'Platform',
    jsonb_build_object('asset', y.asset, 'fee_drops', fee,
                       'meta', jsonb_build_object('period', to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'product', y.asset || ' Flexible', 'source', 'platform')));
  t := public.transition_tx(t.id, 'matched', 'Platform');
  t := public.transition_tx(t.id, 'credited', 'Platform');
  update yield_positions set credited_drops = credited_drops + (gross - fee), rate_updated_at = now(), estimated_accrued_drops = 0
  where customer_id = y.customer_id and product = y.product;
  return gross - fee;
end $$;

-- Daily payout for every position.
create or replace function public.yield_pay_all() returns int
language plpgsql security definer set search_path = public as $$
declare
  y record;
  n int := 0;
begin
  for y in select customer_id, asset from yield_positions where allocated_drops > 0 loop
    if public.yield_pay(y.customer_id, y.asset) > 0 then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Rewards earned so far are paid before an allocation changes, so every period is paid on the amount it held.
create or replace function public.sync_yield_position() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_product text := lower(new.asset) || '_flexible';
begin
  if new.kind = 'yield_allocate' and new.status = 'confirmed' and old.status <> 'confirmed' then
    perform public.yield_pay(new.customer_id, new.asset);
    insert into yield_positions (customer_id, product, asset, allocated_drops, apr_bps, fee_bps)
    values (new.customer_id, v_product, new.asset, new.amount_drops, coalesce((select yield_apr_bps from assets where id = new.asset), 0), 1000)
    on conflict (customer_id, product) do update
      set allocated_drops = yield_positions.allocated_drops + excluded.allocated_drops, apr_bps = excluded.apr_bps;
  elsif new.kind = 'yield_redeem' and new.status = 'confirmed' and old.status <> 'confirmed' then
    perform public.yield_pay(new.customer_id, new.asset);
    update yield_positions set allocated_drops = allocated_drops - new.amount_drops where customer_id = new.customer_id and product = v_product;
  end if;
  return new;
end $$;

create or replace function public.yield_allocate(p_customer uuid, p_amount_drops bigint, p_terms_version text, p_idempotency_key text, p_asset text default 'XRP')
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  t transactions;
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  if a.yield_apr_bps is null then raise exception 'There’s no yield product for % yet.', a.name using errcode = '22023'; end if;
  if p_amount_drops < a.min_product then raise exception 'The minimum allocation is %.', public.fmt_units(a.min_product, a.id) using errcode = '22023'; end if;
  select * into t from transactions where customer_id = p_customer and idempotency_key = p_idempotency_key;
  if found then return t; end if;
  if not exists (select 1 from consents where customer_id = p_customer and document = 'yield') then
    insert into consents (id, customer_id, document, version, surface) values (public.next_ref('CNS'), p_customer, 'yield', p_terms_version, 'Earn · ' || a.id || ' Flexible');
  end if;
  t := public.create_tx(p_customer, 'yield_allocate', public.next_ref('YLD'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('asset', a.id, 'meta', jsonb_build_object('product', a.id || ' Flexible')), p_idempotency_key);
  t := public.transition_tx(t.id, 'sent', 'Platform');
  t := public.transition_tx(t.id, 'confirmed', 'Platform', 'Earning from now');
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Allocated ' || public.fmt_units(p_amount_drops, a.id) || ' to ' || a.id || ' Flexible', t.ref);
  return t;
end $$;

create or replace function public.yield_redeem(p_customer uuid, p_amount_drops bigint, p_idempotency_key text, p_asset text default 'XRP')
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  t transactions;
  allocated bigint;
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  select * into t from transactions where customer_id = p_customer and idempotency_key = p_idempotency_key;
  if found then return t; end if;
  select coalesce(allocated_drops, 0) into allocated from yield_positions where customer_id = p_customer and product = lower(a.id) || '_flexible';
  if p_amount_drops <= 0 or p_amount_drops > coalesce(allocated, 0) then
    raise exception 'You have % allocated.', public.fmt_units(coalesce(allocated, 0), a.id) using errcode = '22023';
  end if;
  t := public.create_tx(p_customer, 'yield_redeem', public.next_ref('YLD'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('asset', a.id, 'meta', jsonb_build_object('product', a.id || ' Flexible')), p_idempotency_key);
  t := public.transition_tx(t.id, 'sent', 'Platform');
  t := public.transition_tx(t.id, 'confirmed', 'Platform', 'Back in your available balance');
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Withdrew ' || public.fmt_units(p_amount_drops, a.id) || ' from ' || a.id || ' Flexible', t.ref);
  return t;
end $$;

-- ───────── Borrow: Compliance decides, the platform lends, staff pay by bank transfer ─────────

alter table public.loans add column if not exists interest_accrued_until timestamptz;

drop function public.loan_apply(uuid, bigint, bigint, bigint, text, text, text);
create function public.loan_apply(
  p_customer uuid, p_collateral_drops bigint, p_principal_cents bigint, p_price_micro bigint, p_agreement_version text, p_idempotency_key text,
  p_asset text default 'XRP', p_payout jsonb default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  t transactions;
  ltv int;
  free bigint;
  bank text := nullif(trim(coalesce(p_payout->>'bank', '')), '');
  acct text := nullif(regexp_replace(coalesce(p_payout->>'account_number', ''), '\s', '', 'g'), '');
  holder text := nullif(trim(coalesce(p_payout->>'account_name', '')), '');
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  if not a.collateral then raise exception '% can’t be used as collateral yet.', a.name using errcode = '22023'; end if;
  if bank is null or holder is null or acct is null or acct !~ '^[A-Za-z0-9-]{6,34}$' then
    raise exception 'Enter the bank, account number and account name to pay the loan to.' using errcode = '22023';
  end if;
  if p_collateral_drops < a.min_collateral then raise exception 'The minimum collateral is %.', public.fmt_units(a.min_collateral, a.id) using errcode = '22023'; end if;
  if p_principal_cents < 10000 then raise exception 'The minimum loan is $100.' using errcode = '22023'; end if;
  ltv := round(p_principal_cents::numeric * power(10::numeric, a.decimals + 4) * 10000 / (p_collateral_drops::numeric * p_price_micro));
  if ltv > 5000 then raise exception 'That’s above the 50%% starting LTV. Borrow less or add collateral.' using errcode = '22023'; end if;
  free := public.account_balance(public.ledger_account(p_customer, 'available', a.id));
  if free < p_collateral_drops then
    raise exception 'You only have % available.', public.fmt_units(free, a.id) using errcode = '22023';
  end if;
  insert into consents (id, customer_id, document, version, surface) values (public.next_ref('CNS'), p_customer, 'lending', p_agreement_version, 'Borrow · new loan')
  on conflict do nothing;
  t := public.create_tx(p_customer, 'loan', public.next_ref('LN'), 'applied', p_collateral_drops, 'Customer',
    jsonb_build_object('asset', a.id, 'amount_cents', p_principal_cents::text,
                       'meta', jsonb_build_object('starting_ltv', to_char(ltv / 100.0, 'FM990.0') || '%', 'price_micro', p_price_micro::text,
                                                  'payout', jsonb_build_object('bank', bank, 'account_number', acct, 'account_name', holder))), p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, p_customer, jsonb_build_array(jsonb_build_array('Identity verified', 'Verified', 'ok'),
    jsonb_build_array('Collateral available', public.fmt_units(p_collateral_drops, a.id) || ' free · locks when you approve', 'ok'),
    jsonb_build_array('Agreement accepted', 'Lending Agreement draft ' || p_agreement_version, 'ok'),
    jsonb_build_array('Pay to ' || bank, holder || ' · account ending ' || right(acct, 4) || ' — the name must match the customer', 'wait'),
    jsonb_build_array('Credit decision', 'Compliance · $' || to_char(p_principal_cents / 100.0, 'FM999,999,990.00') || ' at ' || to_char(ltv / 100.0, 'FM990.0') || '% LTV', 'wait')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted loan application', t.ref);
  return t;
end $$;

-- Approval locks the collateral at once; the loan is funded when staff have paid it.
create or replace function public.loan_lock_on_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'loan' and new.status = 'approved' and old.status <> 'approved' then
    perform public.transition_tx(new.id, 'collateral_locked', 'Platform', 'Collateral locked');
  end if;
  return new;
end $$;
create trigger transactions_loan_lock after update of status on public.transactions for each row execute function public.loan_lock_on_approval();

-- New loans start accruing interest when funded.
create or replace function public.open_loan_record() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  l loans;
begin
  if new.kind = 'loan' and new.status = 'active' and old.status = 'funded' and new.loan_id is null then
    insert into loans (ref, customer_id, principal_usd_cents, apr_bps, collateral_drops, collateral_asset, origination_fee_cents, status, funded_at, next_interest_due, interest_accrued_until)
    values (new.ref, new.customer_id, new.amount_cents, 1000, new.amount_drops, new.asset, (new.amount_cents * 100 + 5000) / 10000, 'active', now(), (now() + interval '1 month')::date, now())
    on conflict (ref) do nothing
    returning * into l;
    if l.id is not null then update transactions set loan_id = l.id where id = new.id; end if;
  end if;
  return new;
end $$;

-- Staff complete what a lending provider would have: paying out an approved loan (bank reference), or confirming a
-- customer's bank repayment arrived. The customer is notified and it's audited.
create or replace function public.loan_settle(p_tx uuid, p_reference text) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  who text := coalesce(public.staff_name(), 'Staff');
  t transactions;
  ref text := trim(coalesce(p_reference, ''));
  usd text;
begin
  if r is null or r not in ('operations', 'compliance') then raise exception 'Read-only role: you can view but not act.' using errcode = '42501'; end if;
  select * into t from transactions where id = p_tx and kind in ('loan', 'loan_repay') for update;
  if not found then raise exception 'Loan transaction not found' using errcode = 'P0002'; end if;
  if length(ref) < 4 then raise exception 'Enter the bank transfer reference.' using errcode = '22023'; end if;
  usd := '$' || to_char(t.amount_cents / 100.0, 'FM999,999,990.00');
  if t.kind = 'loan' and t.status = 'collateral_locked' then
    perform public.transition_tx(t.id, 'funded', who, 'Paid by bank transfer · ' || ref, jsonb_build_object('bank_reference', ref));
    t := public.transition_tx(t.id, 'active', who);
    insert into notifications (customer_id, type, tone, icon, title, body, link) values (t.customer_id, 'tx', 'ok', 'borrow', 'Loan funded',
      usd || ' was sent to ' || coalesce(t.meta->'payout'->>'bank', 'your bank') || ' (reference ' || ref || '). Interest runs from today.', '/loan/manage');
    perform public.audit('staff', auth.uid()::text, who, r, 'Paid out loan by bank transfer', t.ref, jsonb_build_object('reference', ref));
  elsif t.kind = 'loan_repay' and t.status = 'awaiting_payment' then
    perform public.transition_tx(t.id, 'received', who, 'Bank transfer received · ' || ref, jsonb_build_object('bank_reference', ref));
    t := public.transition_tx(t.id, 'applied', who);
    insert into notifications (customer_id, type, tone, icon, title, body, link) values (t.customer_id, 'tx', 'ok', 'borrow', 'Repayment received',
      usd || ' was applied to ' || coalesce(t.meta->>'loan_ref', 'your loan') || '.', '/loan/manage');
    perform public.audit('staff', auth.uid()::text, who, r, 'Confirmed loan repayment received', t.ref, jsonb_build_object('reference', ref));
  else
    raise exception 'There’s nothing to complete on this transaction.' using errcode = '22023';
  end if;
  return t;
end $$;

revoke execute on function public.loan_settle from public, anon;
grant execute on function public.loan_settle(uuid, text) to authenticated;

-- Collateral needed to cover `p_cents` at `p_price` (micro-USD per whole coin), rounded up to the smallest unit.
create or replace function public.units_for_cents(p_cents bigint, p_price bigint, p_decimals int) returns bigint
language sql immutable as $$
  select ceil(p_cents::numeric * power(10::numeric, p_decimals + 4) / p_price)::bigint
$$;

-- Sells collateral on the platform to repay part of a loan: the customer's choice ('sell') or liquidation.
create or replace function public.loan_sell_collateral(p_loan uuid, p_cents bigint, p_price bigint, p_via text, p_actor text, p_key text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  l loans;
  dec int;
  units bigint;
  t transactions;
begin
  select * into l from loans where id = p_loan for update;
  select decimals into dec from assets where id = l.collateral_asset;
  units := public.units_for_cents(p_cents, p_price, dec);
  if units > l.collateral_drops then
    raise exception 'Your collateral (%) isn’t enough to cover that. Repay less.', public.fmt_units(l.collateral_drops, l.collateral_asset) using errcode = '22023';
  end if;
  t := public.create_tx(l.customer_id, 'loan_repay',
    l.ref || ' · ' || case when p_via = 'liquidation' then 'liquidation L' else 'repayment R' end
      || (select count(*) + 1 from transactions where loan_id = l.id and kind = 'loan_repay'),
    'recorded', units, p_actor,
    jsonb_build_object('asset', l.collateral_asset, 'amount_cents', p_cents::text, 'loan_id', l.id::text,
                       'meta', jsonb_build_object('via', p_via, 'loan_ref', l.ref, 'price_micro', p_price::text)), p_key);
  t := public.transition_tx(t.id, 'selling', 'Platform');
  t := public.transition_tx(t.id, 'received', 'Platform', 'Sold ' || public.fmt_units(units, l.collateral_asset) || ' at the live price');
  return public.transition_tx(t.id, 'applied', 'Platform');
end $$;

drop function public.loan_repay(uuid, uuid, bigint, text, text);
create function public.loan_repay(p_customer uuid, p_loan uuid, p_amount_cents bigint, p_via text, p_idempotency_key text, p_price_micro bigint default null)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  l loans;
  t transactions;
  owed bigint;
begin
  perform public.assert_customer_can_transact(p_customer);
  select * into t from transactions where customer_id = p_customer and idempotency_key = p_idempotency_key;
  if found then return t; end if;
  select * into l from loans where id = p_loan and customer_id = p_customer for update;
  if not found then raise exception 'Loan not found' using errcode = 'P0002'; end if;
  if l.status = 'repaid' then raise exception 'This loan is already repaid.' using errcode = '22023'; end if;
  owed := l.principal_usd_cents + l.interest_usd_cents - l.repaid_usd_cents;
  if p_amount_cents <= 0 then raise exception 'Enter an amount to repay.' using errcode = '22023'; end if;
  if p_amount_cents > owed then raise exception 'That’s more than you owe ($%).', to_char(owed / 100.0, 'FM999,999,990.00') using errcode = '22023'; end if;
  if p_via = 'sell' then
    if coalesce(p_price_micro, 0) <= 0 then raise exception 'There’s no current price right now. Try again in a minute.' using errcode = '22023'; end if;
    return public.loan_sell_collateral(l.id, p_amount_cents, p_price_micro, 'sell', 'Customer', p_idempotency_key);
  end if;
  t := public.create_tx(p_customer, 'loan_repay', l.ref || ' · repayment R' || (select count(*) + 1 from transactions where loan_id = l.id and kind = 'loan_repay'),
    'recorded', null, 'Customer', jsonb_build_object('amount_cents', p_amount_cents::text, 'loan_id', l.id::text,
      'meta', jsonb_build_object('via', 'bank', 'loan_ref', l.ref, 'payment_reference', l.ref || '-R' || (select count(*) + 1 from transactions where loan_id = l.id and kind = 'loan_repay'))),
    p_idempotency_key);
  return public.transition_tx(t.id, 'awaiting_payment', 'Platform');
end $$;

-- Top-ups lock at once.
create or replace function public.loan_add_collateral(p_customer uuid, p_loan uuid, p_amount_drops bigint, p_idempotency_key text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  l loans;
  a assets;
  t transactions;
begin
  perform public.assert_customer_can_transact(p_customer);
  select * into t from transactions where customer_id = p_customer and idempotency_key = p_idempotency_key;
  if found then return t; end if;
  select * into l from loans where id = p_loan and customer_id = p_customer for update;
  if not found then raise exception 'Loan not found' using errcode = 'P0002'; end if;
  if l.status = 'repaid' then raise exception 'This loan is already repaid.' using errcode = '22023'; end if;
  a := public.asset_spec(l.collateral_asset);
  if p_amount_drops < a.min_product then raise exception 'The minimum top-up is %.', public.fmt_units(a.min_product, a.id) using errcode = '22023'; end if;
  t := public.create_tx(p_customer, 'loan_collateral', l.ref || ' · collateral C' || (select count(*) + 1 from transactions where loan_id = l.id and kind = 'loan_collateral'),
    'recorded', p_amount_drops, 'Customer', jsonb_build_object('asset', a.id, 'loan_id', l.id::text, 'meta', jsonb_build_object('loan_ref', l.ref)), p_idempotency_key);
  t := public.transition_tx(t.id, 'sent', 'Platform');
  t := public.transition_tx(t.id, 'lock_confirmed', 'Platform', 'Collateral locked');
  return public.transition_tx(t.id, 'ltv_updated', 'Platform');
end $$;

-- Applied repayments reduce what's owed; collateral sold to repay leaves the loan. A loan repaid in full releases
-- whatever collateral is left.
create or replace function public.sync_loan() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  l loans;
  loan_tx uuid;
begin
  if new.kind = 'loan_collateral' and new.status = 'lock_confirmed' and old.status <> 'lock_confirmed' then
    update loans set collateral_drops = collateral_drops + new.amount_drops where id = new.loan_id;
  elsif new.kind = 'loan_repay' and new.status = 'applied' and old.status <> 'applied' then
    update loans set repaid_usd_cents = repaid_usd_cents + new.amount_cents,
                     collateral_drops = collateral_drops - case when new.meta->>'via' in ('sell', 'liquidation') then coalesce(new.amount_drops, 0) else 0 end
    where id = new.loan_id returning * into l;
    if l.repaid_usd_cents >= l.principal_usd_cents + l.interest_usd_cents then
      update loans set status = 'repaid' where id = l.id;
      select id into loan_tx from transactions where loan_id = l.id and kind = 'loan' and status in ('active', 'margin_call') limit 1;
      if loan_tx is not null then
        update transactions set amount_drops = l.collateral_drops where id = loan_tx;
        perform public.transition_tx(loan_tx, 'repaid', 'Platform', 'Loan repaid in full; collateral released');
      end if;
      insert into notifications (customer_id, type, tone, icon, title, body, link) values (l.customer_id, 'tx', 'ok', 'borrow', 'Loan repaid',
        l.ref || ' is fully repaid.' || case when l.collateral_drops > 0 then ' ' || public.fmt_units(l.collateral_drops, l.collateral_asset) || ' collateral is back in your available balance.' else '' end, '/');
    end if;
  end if;
  return new;
end $$;

-- Daily interest on what's owed, at the loan's APR.
create or replace function public.loan_accrue_interest() returns int
language plpgsql security definer set search_path = public as $$
declare
  l loans;
  add bigint;
  n int := 0;
begin
  for l in select * from loans where status in ('active', 'margin_call', 'liquidating') for update loop
    add := floor((l.principal_usd_cents + l.interest_usd_cents - l.repaid_usd_cents)::numeric * l.apr_bps
                 * extract(epoch from now() - coalesce(l.interest_accrued_until, l.funded_at, l.created_at)) / (10000::numeric * 365 * 86400));
    if add >= 1 then
      update loans set interest_usd_cents = interest_usd_cents + add, interest_accrued_until = now() where id = l.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- LTV monitor. At 80% the platform sells enough collateral at the live price to repay the loan; whatever is left
-- is released. If the collateral doesn't cover it, the shortfall stays owed and the loan stays in liquidation.
create or replace function public.ltv_check() returns void
language plpgsql security definer set search_path = public as $$
declare
  l loans;
  price bigint;
  dec int;
  owed bigint;
  ltv int;
  units bigint;
  cents bigint;
  sold transactions;
begin
  for l in select * from loans where status in ('active', 'margin_call', 'liquidating') and collateral_drops > 0 for update loop
    select usd_micro into price from prices where asset = l.collateral_asset and at > now() - interval '15 minutes' order by at desc limit 1;
    if price is null then continue; end if; -- never act on a stale price
    select decimals into dec from assets where id = l.collateral_asset;
    owed := l.principal_usd_cents + l.interest_usd_cents - l.repaid_usd_cents;
    if owed <= 0 then continue; end if;
    ltv := round(owed::numeric * power(10::numeric, dec + 4) * 10000 / nullif(l.collateral_drops::numeric * price, 0));
    if ltv >= l.liquidation_bps then
      update loans set status = 'liquidating' where id = l.id;
      units := least(public.units_for_cents(owed, price, dec), l.collateral_drops);
      cents := least(owed, floor(units::numeric * price / power(10::numeric, dec + 4))::bigint);
      if cents > 0 then
        sold := public.loan_sell_collateral(l.id, cents, price, 'liquidation', 'Platform', 'liq:' || l.id || ':' || extract(epoch from now())::bigint);
        insert into notifications (customer_id, type, tone, icon, title, body, link) values (l.customer_id, 'tx', 'bad', 'alert', 'Collateral sold',
          'Your LTV on ' || l.ref || ' reached ' || (l.liquidation_bps / 100) || '%, so we sold ' || public.fmt_units(sold.amount_drops, l.collateral_asset)
            || ' to repay $' || to_char(cents / 100.0, 'FM999,999,990.00') || '.', '/loan/manage');
        perform public.audit('system', 'ltv-monitor', 'System', null,
          'Liquidated ' || public.fmt_units(sold.amount_drops, l.collateral_asset) || ' at ' || (ltv / 100) || '% LTV'
            || case when cents < owed then ' · shortfall $' || to_char((owed - cents) / 100.0, 'FM999,999,990.00') else '' end, l.ref);
      end if;
    elsif ltv >= l.margin_bps and l.status = 'active' then
      update loans set status = 'margin_call' where id = l.id;
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (l.customer_id, 'tx', 'warn', 'alert', 'Margin call', 'LTV on ' || l.ref || ' is above 65%. Add collateral or repay before it reaches 80%.', '/loan/manage');
    elsif ltv >= 5500 and ltv < l.margin_bps and not exists (
      select 1 from notifications where customer_id = l.customer_id and title = 'LTV above 55%' and created_at > now() - interval '1 day'
    ) then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (l.customer_id, 'tx', 'warn', 'alert', 'LTV above 55%', 'Your loan ' || l.ref || ' is getting closer to the 65% margin call.', '/borrow');
    elsif ltv < l.margin_bps and l.status = 'margin_call' then
      update loans set status = 'active' where id = l.id;
    end if;
  end loop;
end $$;

create or replace function public.run_job(p_job text) returns void
language plpgsql security definer set search_path = public as $$
begin
  case p_job
    when 'ltv-check' then perform public.ltv_check();
    when 'quote-expiry' then perform public.expire_quotes();
    when 'yield-accrual' then perform public.estimate_yield_accrual();
    when 'yield-rewards' then perform public.yield_pay_all();
    when 'loan-interest' then perform public.loan_accrue_interest();
    when 'audit-verify' then perform public.run_audit_verification();
    when 'mfa-disable' then perform public.apply_mfa_disable();
    when 'balances-snapshot' then refresh materialized view concurrently public.balances_snapshot;
    else raise exception 'Unknown job: %', p_job using errcode = '22023';
  end case;
end $$;

revoke execute on function public.yield_pay, public.yield_pay_all, public.loan_sell_collateral, public.loan_accrue_interest,
  public.loan_apply, public.loan_repay, public.loan_add_collateral, public.yield_allocate, public.yield_redeem, public.units_for_cents
  from public, anon, authenticated;
