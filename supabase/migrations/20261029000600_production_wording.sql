-- Production wording and deposits before verification (owner's decisions, 2026-10-29).

-- Deposits are open to every customer whose account isn't frozen; identity verification gates withdrawals, swaps,
-- Earn and Borrow only. Staff still confirm every deposit before it's credited.
create or replace function public.report_deposit(
  p_customer uuid, p_asset text, p_amount bigint, p_tx_hash text, p_from text, p_idempotency_key text, p_network text default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  n asset_networks;
  t transactions;
  h text := trim(coalesce(p_tx_hash, ''));
begin
  -- Deposits don't need identity verification (owner's decision, 2026-10-29); a frozen account still can't.
  select * into c from customers where id = p_customer;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;
  if c.frozen_at is not null then raise exception 'Your account is frozen. Contact support.' using errcode = '42501'; end if;
  a := public.asset_spec(p_asset);
  n := public.asset_network(a.id, p_network);
  if a.deposit_mode <> 'reported' then
    raise exception '% deposits are credited automatically once validated.', a.name using errcode = '22023';
  end if;
  if n.deposit_address is null then raise exception '% deposits on % aren’t open yet.', a.name, n.name using errcode = '22023'; end if;
  if p_amount < a.min_deposit then raise exception 'The minimum deposit is %.', public.fmt_units(a.min_deposit, a.id) using errcode = '22023'; end if;
  if length(h) < 8 or h !~ '^[A-Za-z0-9:_-]+$' then raise exception 'Enter the transaction hash (ID) from your wallet.' using errcode = '22023'; end if;
  if exists (select 1 from transactions where kind = 'deposit' and asset = a.id and meta->>'tx_hash' = h and status <> 'rejected') then
    raise exception 'That transaction has already been reported.' using errcode = '22023';
  end if;
  t := public.create_tx(p_customer, 'deposit', public.next_ref('DEP'), 'reported', p_amount, 'Customer',
    jsonb_build_object('asset', a.id, 'counterparty', nullif(trim(coalesce(p_from, '')), ''),
                       'destination_tag', case when n.memo_kind = 'tag' then c.destination_tag::text end,
                       'meta', jsonb_build_object('tx_hash', h, 'reported_by', 'customer', 'to_address', n.deposit_address,
                                                  'network', n.network, 'network_name', n.name)),
    p_idempotency_key);
  insert into approvals (transaction_id, required, requires_compliance, requested_by, checks)
  values (t.id, 1, false, p_customer, jsonb_build_array(
    jsonb_build_array('Reported by customer', public.fmt_units(p_amount, a.id) || ' · hash ' || left(h, 12) || '…', 'wait'),
    jsonb_build_array('Confirm on ' || n.name, 'Amount, confirmations and receiving address ' || left(n.deposit_address, 10) || '…', 'wait'))
    || case when n.memo_kind = 'tag'
         then jsonb_build_array(jsonb_build_array('Destination tag ' || c.destination_tag,
                'The transaction must carry this customer’s tag; any other tag belongs to someone else', 'wait'))
         else '[]'::jsonb end);
  perform public.notify_transition(t);
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Reported deposit of ' || public.fmt_units(p_amount, a.id) || ' on ' || n.name, t.ref);
  return t;
end $$;

-- Timelines show who quoted ("Trading desk"), not a placeholder.
create or replace function public.record_quote(p_tx uuid, p_price_micro bigint, p_fee_cents bigint, p_receive_cents bigint, p_expires_at timestamptz, p_receive_units bigint default null)
returns public.quotes language plpgsql security definer set search_path = public as $$
declare
  q quotes;
begin
  insert into quotes (transaction_id, price_micro, fee_cents, receive_cents, expires_at, receive_units)
  values (p_tx, p_price_micro, p_fee_cents, p_receive_cents, p_expires_at, p_receive_units) returning * into q;
  perform public.transition_tx(p_tx, 'quoted', 'Trading desk');
  return q;
end $$;

-- Approval checks name the agreement without "draft".
create or replace function public.loan_apply(
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
    jsonb_build_array('Agreement accepted', 'Lending and Collateral Agreement ' || p_agreement_version, 'ok'),
    jsonb_build_array('Pay to ' || bank, holder || ' · account ending ' || right(acct, 4) || ' — the name must match the customer', 'wait'),
    jsonb_build_array('Credit decision', 'Compliance · $' || to_char(p_principal_cents / 100.0, 'FM999,999,990.00') || ' at ' || to_char(ltv / 100.0, 'FM990.0') || '% LTV', 'wait')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted loan application', t.ref);
  return t;
end $$;

-- Legal documents are version 1.0 (not "v0.1 draft").
update public.legal_documents set current_version = '1.0' where current_version = 'v0.1';
update public.legal_documents set change_summary = null where change_summary ilike '%draft%';
