-- Atomic money operations. Called only by Edge Functions (service role) after auth, validation and idempotency checks.
-- Every rule that protects money is enforced here, inside the same database transaction that posts the journal.

create sequence if not exists public.ref_seq_wd start 2100;
create sequence if not exists public.ref_seq_ex start 400;
create sequence if not exists public.ref_seq_yld start 200;
create sequence if not exists public.ref_seq_ln start 20;
create sequence if not exists public.ref_seq_dep start 2100;
create sequence if not exists public.ref_seq_sup start 1000;
create sequence if not exists public.ref_seq_cns start 100;

create or replace function public.next_ref(p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare
  n bigint;
begin
  n := case p_prefix
    when 'WD' then nextval('ref_seq_wd') when 'EX' then nextval('ref_seq_ex') when 'YLD' then nextval('ref_seq_yld')
    when 'LN' then nextval('ref_seq_ln') when 'DEP' then nextval('ref_seq_dep') when 'SUP' then nextval('ref_seq_sup')
    when 'CNS' then nextval('ref_seq_cns') end;
  if p_prefix = 'SUP' then return 'SUP-' || lpad(n::text, 4, '0'); end if;
  if p_prefix = 'CNS' then return 'CNS-' || lpad(n::text, 6, '0'); end if;
  return p_prefix || '-' || lpad(n::text, 6, '0');
end $$;

-- Shared customer gate: exists, not frozen, verified (decision: verify first for every money action).
create or replace function public.assert_customer_can_transact(p_customer uuid) returns public.customers
language plpgsql security definer set search_path = public as $$
declare
  c customers;
begin
  select * into c from customers where id = p_customer for share;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;
  if c.frozen_at is not null then raise exception 'Your account is frozen. Contact support.' using errcode = '42501'; end if;
  if c.kyc_status <> 'verified' then raise exception 'Verify your identity to continue.' using errcode = '42501'; end if;
  return c;
end $$;

-- 24-hour hold after a password change or turning 2FA off (TDD: account takeover controls).
alter table public.customers add column if not exists withdrawals_hold_until timestamptz;

-- ───────── Withdrawals ─────────
create or replace function public.request_withdrawal(
  p_customer uuid, p_amount_drops bigint, p_destination text, p_tag bigint, p_idempotency_key text, p_device_paused boolean default false
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  t transactions;
  today_out bigint;
  daily_limit bigint;
  fee bigint := 250000; -- 0.25 XRP platform fee, deducted from the amount
  two boolean;
begin
  c := public.assert_customer_can_transact(p_customer);
  if p_device_paused then raise exception 'Withdrawals from this device are paused for 24 hours after a new sign-in.' using errcode = '42501'; end if;
  if c.withdrawals_hold_until > now() then
    raise exception 'Withdrawals are on hold until % after a security change.', to_char(c.withdrawals_hold_until at time zone 'Africa/Lagos', 'Mon FMDD, HH24:MI') using errcode = '42501';
  end if;
  if p_amount_drops < 10000000 then raise exception 'The minimum withdrawal is 10 XRP.' using errcode = '22023'; end if;
  if p_destination !~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$' then raise exception 'That isn’t a valid XRP Ledger address.' using errcode = '22023'; end if;
  if c.allowlist_enabled and not exists (
    select 1 from allowlist_addresses where customer_id = p_customer and address = p_destination and removed_at is null
      and active_from <= now() and coalesce(tag, -1) = coalesce(p_tag, -1)
  ) then
    raise exception 'Your allowlist is on. Choose a saved address, or add this one in Security — it activates after 24 hours.' using errcode = '42501';
  end if;
  select amount_drops into daily_limit from limits where id = 'customer_daily';
  select coalesce(sum(amount_drops), 0) into today_out from transactions
  where customer_id = p_customer and kind = 'withdrawal' and status not in ('rejected', 'failed', 'cancelled') and created_at > now() - interval '24 hours';
  if today_out + p_amount_drops > coalesce(daily_limit, 25000000000) then
    raise exception 'That’s over your daily withdrawal limit.' using errcode = '22023';
  end if;
  two := p_amount_drops > 1000000000;
  -- create_tx posts available → reserved and fails if the balance would go negative.
  t := public.create_tx(p_customer, 'withdrawal', public.next_ref('WD'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('fee_drops', fee, 'network_fee_drops', 12, 'counterparty', p_destination, 'destination_tag', p_tag::text,
                       'meta', jsonb_build_object('approvals_required', case when two then '2' else '1' end)),
    p_idempotency_key);
  insert into approvals (transaction_id, required, requires_compliance, requested_by, checks)
  values (t.id, case when two then 2 else 1 end, two, p_customer, jsonb_build_array(
    jsonb_build_array('Balance reserved', 'Ledger hold posted at ' || to_char(now() at time zone 'Africa/Lagos', 'HH24:MI'), 'ok'),
    jsonb_build_array('2FA confirmed by customer', 'Authenticator, ' || to_char(now() at time zone 'Africa/Lagos', 'HH24:MI'), 'ok'),
    jsonb_build_array('Within daily limit', ((today_out + p_amount_drops) / 1000000)::text || ' of ' || (coalesce(daily_limit, 25000000000) / 1000000)::text || ' XRP', 'ok'),
    case when exists (select 1 from allowlist_addresses where customer_id = p_customer and address = p_destination and removed_at is null)
      then jsonb_build_array('Allowlisted address', 'Saved destination', 'ok')
      else jsonb_build_array('New destination', 'First withdrawal to this address', 'warn') end
  ));
  t := public.transition_tx(t.id, 'in_review', 'System');
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted withdrawal (2FA verified)', t.ref);
  perform public.audit('system', 'ledger', 'System', null, 'Reserved ' || to_char(p_amount_drops / 1000000.0, 'FM999,999,990.00') || ' XRP', t.ref);
  return t;
end $$;

create or replace function public.cancel_withdrawal(p_customer uuid, p_tx uuid) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  t transactions;
begin
  select * into t from transactions where id = p_tx and customer_id = p_customer and kind = 'withdrawal' for update;
  if not found then raise exception 'Withdrawal not found' using errcode = 'P0002'; end if;
  if t.status not in ('requested', 'in_review') then raise exception 'This withdrawal can no longer be cancelled.' using errcode = '22023'; end if;
  update approvals set status = 'rejected' where transaction_id = t.id and status = 'pending';
  return public.transition_tx(t.id, 'cancelled', 'Customer', 'Cancelled by customer');
end $$;

-- ───────── Exchange (manual) ─────────
create or replace function public.request_exchange(p_customer uuid, p_amount_drops bigint, p_indicative_cents bigint, p_idempotency_key text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  t transactions;
begin
  c := public.assert_customer_can_transact(p_customer);
  if p_amount_drops < 50000000 then raise exception 'The minimum request is 50 XRP.' using errcode = '22023'; end if;
  if public.account_balance(public.ledger_account(p_customer, 'available')) < p_amount_drops then
    raise exception 'That’s more than your available balance.' using errcode = '22023';
  end if;
  -- Nothing is reserved until the customer accepts a firm quote.
  t := public.create_tx(p_customer, 'exchange', public.next_ref('EX'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('meta', jsonb_build_object('indicative_cents', p_indicative_cents::text)), p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, p_customer, jsonb_build_array(jsonb_build_array('Customer eligible', 'Verified, within exchange limits', 'ok'), jsonb_build_array('Liquidity provider quote', 'Not requested yet', 'wait')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted exchange request', t.ref);
  return t;
end $$;

create or replace function public.record_quote(p_tx uuid, p_price_micro bigint, p_fee_cents bigint, p_receive_cents bigint, p_expires_at timestamptz)
returns public.quotes language plpgsql security definer set search_path = public as $$
declare
  q quotes;
begin
  insert into quotes (transaction_id, price_micro, fee_cents, receive_cents, expires_at) values (p_tx, p_price_micro, p_fee_cents, p_receive_cents, p_expires_at) returning * into q;
  perform public.transition_tx(p_tx, 'quoted', '[Liquidity provider]');
  return q;
end $$;

create or replace function public.accept_quote(p_customer uuid, p_tx uuid, p_quote uuid) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  t transactions;
  q quotes;
begin
  perform public.assert_customer_can_transact(p_customer);
  select * into t from transactions where id = p_tx and customer_id = p_customer and kind = 'exchange' for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  select * into q from quotes where id = p_quote and transaction_id = p_tx for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if q.accepted_at is not null then return t; end if;
  if q.expires_at < now() then raise exception 'This quote has expired. Request a new one.' using errcode = '22023'; end if;
  update quotes set accepted_at = now() where id = q.id;
  -- accepted: available → reserved (fails on insufficient balance).
  return public.transition_tx(p_tx, 'accepted', 'Customer', null, jsonb_build_object('quote_id', q.id::text, 'price_micro', q.price_micro::text, 'receive_cents', q.receive_cents::text));
end $$;

create or replace function public.cancel_exchange(p_customer uuid, p_tx uuid) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  t transactions;
begin
  select * into t from transactions where id = p_tx and customer_id = p_customer and kind = 'exchange' for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  update approvals set status = 'rejected' where transaction_id = t.id and status = 'pending';
  return public.transition_tx(t.id, 'cancelled', 'Customer');
end $$;

-- ───────── Yield ─────────
create or replace function public.yield_allocate(p_customer uuid, p_amount_drops bigint, p_terms_version text, p_idempotency_key text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  t transactions;
begin
  c := public.assert_customer_can_transact(p_customer);
  if p_amount_drops < 50000000 then raise exception 'The minimum allocation is 50 XRP.' using errcode = '22023'; end if;
  if not exists (select 1 from consents where customer_id = p_customer and document = 'yield') then
    insert into consents (id, customer_id, document, version, surface) values (public.next_ref('CNS'), p_customer, 'yield', p_terms_version, 'Earn · XRP Flexible');
  end if;
  -- requested: available → pending_yield.
  t := public.create_tx(p_customer, 'yield_allocate', public.next_ref('YLD'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('meta', jsonb_build_object('product', 'XRP Flexible')), p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, p_customer, jsonb_build_array(jsonb_build_array('Product terms accepted', 'Yield Product Terms draft ' || p_terms_version, 'ok'), jsonb_build_array('Above minimum', (p_amount_drops / 1000000)::text || ' ≥ 50 XRP', 'ok')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Allocated ' || (p_amount_drops / 1000000)::text || ' XRP to XRP Flexible', t.ref);
  return t;
end $$;

create or replace function public.yield_redeem(p_customer uuid, p_amount_drops bigint, p_idempotency_key text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  t transactions;
  allocated bigint;
begin
  c := public.assert_customer_can_transact(p_customer);
  select coalesce(allocated_drops, 0) into allocated from yield_positions where customer_id = p_customer and product = 'xrp_flexible';
  if p_amount_drops <= 0 or p_amount_drops > coalesce(allocated, 0) then
    raise exception 'You have % XRP allocated.', to_char(coalesce(allocated, 0) / 1000000.0, 'FM999,999,990.00') using errcode = '22023';
  end if;
  t := public.create_tx(p_customer, 'yield_redeem', public.next_ref('YLD'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('meta', jsonb_build_object('product', 'XRP Flexible')), p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by) values (t.id, 1, p_customer);
  return t;
end $$;

-- Provider-confirmed yield movements keep yield_positions in step with the journal.
create or replace function public.sync_yield_position() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'yield_allocate' and new.status = 'confirmed' and old.status <> 'confirmed' then
    insert into yield_positions (customer_id, product, allocated_drops, apr_bps, fee_bps) values (new.customer_id, 'xrp_flexible', new.amount_drops, 300, 1000)
    on conflict (customer_id, product) do update set allocated_drops = yield_positions.allocated_drops + excluded.allocated_drops;
  elsif new.kind = 'yield_redeem' and new.status = 'confirmed' and old.status <> 'confirmed' then
    update yield_positions set allocated_drops = allocated_drops - new.amount_drops where customer_id = new.customer_id and product = 'xrp_flexible';
  end if;
  return new;
end $$;
create trigger transactions_sync_yield after update of status on public.transactions for each row execute function public.sync_yield_position();

-- ───────── Loans ─────────
create or replace function public.loan_apply(p_customer uuid, p_collateral_drops bigint, p_principal_cents bigint, p_price_micro bigint, p_agreement_version text, p_idempotency_key text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  t transactions;
  ltv int;
begin
  c := public.assert_customer_can_transact(p_customer);
  if p_collateral_drops < 100000000 then raise exception 'The minimum collateral is 100 XRP.' using errcode = '22023'; end if;
  if p_principal_cents < 10000 then raise exception 'The minimum loan is $100.' using errcode = '22023'; end if;
  ltv := round(p_principal_cents::numeric * 1e14 / (p_collateral_drops::numeric * p_price_micro));
  if ltv > 5000 then raise exception 'That’s above the 50%% starting LTV. Borrow less or add collateral.' using errcode = '22023'; end if;
  if public.account_balance(public.ledger_account(p_customer, 'available')) < p_collateral_drops then
    raise exception 'You only have % XRP available.', to_char(public.account_balance(public.ledger_account(p_customer, 'available')) / 1000000.0, 'FM999,999,990.00') using errcode = '22023';
  end if;
  insert into consents (id, customer_id, document, version, surface) values (public.next_ref('CNS'), p_customer, 'lending', p_agreement_version, 'Borrow · new loan')
  on conflict do nothing;
  t := public.create_tx(p_customer, 'loan', public.next_ref('LN'), 'applied', p_collateral_drops, 'Customer',
    jsonb_build_object('amount_cents', p_principal_cents::text, 'meta', jsonb_build_object('starting_ltv', to_char(ltv / 100.0, 'FM990.0') || '%')), p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, p_customer, jsonb_build_array(jsonb_build_array('Identity verified', 'Verified', 'ok'), jsonb_build_array('Collateral available', to_char(p_collateral_drops / 1000000.0, 'FM999,999,990.00') || ' XRP free', 'ok'),
    jsonb_build_array('Agreement accepted', 'Lending Agreement draft ' || p_agreement_version, 'ok'), jsonb_build_array('Provider credit decision', 'Pending', 'wait')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted loan application', t.ref);
  return t;
end $$;

create or replace function public.loan_repay(p_customer uuid, p_loan uuid, p_amount_cents bigint, p_via text, p_idempotency_key text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  l loans;
  t transactions;
  owed bigint;
begin
  perform public.assert_customer_can_transact(p_customer);
  select * into l from loans where id = p_loan and customer_id = p_customer for update;
  if not found then raise exception 'Loan not found' using errcode = 'P0002'; end if;
  owed := l.principal_usd_cents + l.interest_usd_cents - l.repaid_usd_cents;
  if p_amount_cents <= 0 then raise exception 'Enter an amount to repay.' using errcode = '22023'; end if;
  if p_amount_cents > owed then raise exception 'That’s more than you owe ($%).', to_char(owed / 100.0, 'FM999,999,990.00') using errcode = '22023'; end if;
  t := public.create_tx(p_customer, 'loan_repay', l.ref || ' · repayment R' || (select count(*) + 1 from transactions where loan_id = l.id and kind = 'loan_repay'),
    'recorded', null, 'Customer', jsonb_build_object('amount_cents', p_amount_cents::text, 'loan_id', l.id::text,
      'meta', jsonb_build_object('via', p_via, 'loan_ref', l.ref, 'payment_reference', replace(l.ref, '-PROTO-', '') || '-R1')), p_idempotency_key);
  return public.transition_tx(t.id, case when p_via = 'bank' then 'awaiting_payment' else 'selling' end, 'System');
end $$;

create or replace function public.loan_add_collateral(p_customer uuid, p_loan uuid, p_amount_drops bigint, p_idempotency_key text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  l loans;
begin
  perform public.assert_customer_can_transact(p_customer);
  select * into l from loans where id = p_loan and customer_id = p_customer for update;
  if not found then raise exception 'Loan not found' using errcode = 'P0002'; end if;
  if p_amount_drops < 50000000 then raise exception 'The minimum top-up is 50 XRP.' using errcode = '22023'; end if;
  -- recorded: available → reserved; lock_confirmed: reserved → collateral (provider webhook).
  return public.create_tx(p_customer, 'loan_collateral', l.ref || ' · collateral C' || (select count(*) + 1 from transactions where loan_id = l.id and kind = 'loan_collateral'),
    'recorded', p_amount_drops, 'Customer', jsonb_build_object('loan_id', l.id::text, 'meta', jsonb_build_object('loan_ref', l.ref)), p_idempotency_key);
end $$;

-- Provider-confirmed loan movements update the loan record.
create or replace function public.sync_loan() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  l loans;
  loan_tx uuid;
begin
  if new.kind = 'loan_collateral' and new.status = 'lock_confirmed' and old.status <> 'lock_confirmed' then
    update loans set collateral_drops = collateral_drops + new.amount_drops where id = new.loan_id;
  elsif new.kind = 'loan_repay' and new.status = 'applied' and old.status <> 'applied' then
    update loans set repaid_usd_cents = repaid_usd_cents + new.amount_cents where id = new.loan_id returning * into l;
    if l.repaid_usd_cents >= l.principal_usd_cents + l.interest_usd_cents then
      update loans set status = 'repaid' where id = l.id;
      -- loan:repaid posts collateral → available for the original collateral; top-ups are released too.
      select id into loan_tx from transactions where loan_id = l.id and kind = 'loan' and status in ('active', 'margin_call') limit 1;
      if loan_tx is not null then
        update transactions set amount_drops = l.collateral_drops where id = loan_tx;
        perform public.transition_tx(loan_tx, 'repaid', '[Lending provider]', 'Loan repaid in full; collateral released');
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger transactions_sync_loan after update of status on public.transactions for each row execute function public.sync_loan();

revoke execute on function public.request_withdrawal, public.cancel_withdrawal, public.request_exchange, public.record_quote, public.accept_quote,
  public.cancel_exchange, public.yield_allocate, public.yield_redeem, public.loan_apply, public.loan_repay, public.loan_add_collateral,
  public.next_ref, public.assert_customer_can_transact from anon, authenticated, public;
