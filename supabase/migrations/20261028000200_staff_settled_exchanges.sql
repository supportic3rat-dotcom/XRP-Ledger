-- Sell for USD is back (owner's decision, 2026-10-28), paid by bank transfer: the customer gives the bank account
-- with the request, and once they accept the quote, Operations pays it and marks it paid with the bank reference.
-- Swaps are completed the same way (the bought coin is credited). There is no liquidity or payout provider, so
-- staff settle what their webhooks would have; the webhook path stays for when one is contracted.

drop function public.request_exchange(uuid, bigint, bigint, text, text, text);
create function public.request_exchange(
  p_customer uuid, p_amount_drops bigint, p_indicative_cents bigint, p_idempotency_key text,
  p_asset text default 'XRP', p_to_asset text default null, p_payout jsonb default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  b assets;
  t transactions;
  bank text := nullif(trim(coalesce(p_payout->>'bank', '')), '');
  acct text := nullif(regexp_replace(coalesce(p_payout->>'account_number', ''), '\s', '', 'g'), '');
  holder text := nullif(trim(coalesce(p_payout->>'account_name', '')), '');
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  if p_to_asset is not null then
    b := public.asset_spec(p_to_asset);
    if b.id = a.id then raise exception 'Choose a different asset to receive.' using errcode = '22023'; end if;
  elsif bank is null or holder is null or acct is null or acct !~ '^[A-Za-z0-9-]{6,34}$' then
    raise exception 'Enter the bank, account number and account name to be paid.' using errcode = '22023';
  end if;
  if p_amount_drops < a.min_product then raise exception 'The minimum request is %.', public.fmt_units(a.min_product, a.id) using errcode = '22023'; end if;
  if public.account_balance(public.ledger_account(p_customer, 'available', a.id)) < p_amount_drops then
    raise exception 'That’s more than your available balance.' using errcode = '22023';
  end if;
  t := public.create_tx(p_customer, 'exchange', public.next_ref('EX'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('asset', a.id, 'counter_asset', p_to_asset,
                       'meta', jsonb_strip_nulls(jsonb_build_object(
                         'indicative_cents', p_indicative_cents::text, 'receive', coalesce(p_to_asset, 'USD'),
                         'payout', case when p_to_asset is null then jsonb_build_object('bank', bank, 'account_number', acct, 'account_name', holder) end))),
    p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, p_customer, jsonb_build_array(
    jsonb_build_array('Customer eligible', 'Verified, within exchange limits', 'ok'),
    jsonb_build_array(case when p_to_asset is null then 'Sell ' || a.id || ' for USD' else 'Swap ' || a.id || ' → ' || p_to_asset end, public.fmt_units(p_amount_drops, a.id), 'ok'))
    || case when p_to_asset is null
         then jsonb_build_array(jsonb_build_array('Pay to ' || bank, holder || ' · account ending ' || right(acct, 4) || ' — the name must match the customer', 'wait'))
         else '[]'::jsonb end
    || jsonb_build_array(jsonb_build_array('Liquidity provider quote', 'Not requested yet', 'wait')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted exchange request', t.ref);
  return t;
end $$;

revoke execute on function public.request_exchange from public, anon, authenticated;

-- Operations (or Compliance) settles an accepted exchange: a USD sale once the bank transfer is made, a swap once the
-- coin is credited from the platform wallet. The ledger posts the sale leg and, for a swap, the bought coin.
create or replace function public.exchange_complete(p_tx uuid, p_reference text) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  who text := coalesce(public.staff_name(), 'Staff');
  t transactions;
  ref text := trim(coalesce(p_reference, ''));
  usd bigint;
begin
  if r is null or r not in ('operations', 'compliance') then raise exception 'Read-only role: you can view but not act.' using errcode = '42501'; end if;
  select * into t from transactions where id = p_tx and kind = 'exchange' for update;
  if not found then raise exception 'Exchange not found' using errcode = 'P0002'; end if;
  if t.status <> 'accepted' then raise exception 'Only exchanges the customer has accepted can be completed.' using errcode = '22023'; end if;
  if t.counter_asset is null and length(ref) < 4 then raise exception 'Enter the bank transfer reference.' using errcode = '22023'; end if;
  perform public.transition_tx(t.id, 'sold', who, case when t.counter_asset is null then 'Sold for USD' else 'Swap filled' end);
  if t.counter_asset is null then
    select receive_cents into usd from quotes where transaction_id = t.id and accepted_at is not null order by accepted_at desc limit 1;
    t := public.transition_tx(t.id, 'paid_out', who, 'Paid by bank transfer · ' || ref, jsonb_build_object('bank_reference', ref));
    insert into notifications (customer_id, type, tone, icon, title, body, link) values (
      t.customer_id, 'tx', 'ok', 'ex', 'USD payout sent',
      '$' || to_char(coalesce(usd, 0) / 100.0, 'FM999,999,999,990.00') || ' for ' || t.ref || ' was sent to '
        || coalesce(t.meta->'payout'->>'bank', 'your bank') || ' (reference ' || ref || ').', '/');
  else
    t := public.transition_tx(t.id, 'paid_out', who, nullif('Credited · ' || ref, 'Credited · '), jsonb_strip_nulls(jsonb_build_object('reference', nullif(ref, ''))));
  end if;
  perform public.audit('staff', auth.uid()::text, who, r,
    case when t.counter_asset is null then 'Paid USD sale by bank transfer' else 'Completed swap into ' || t.counter_asset end,
    t.ref, jsonb_strip_nulls(jsonb_build_object('reference', nullif(ref, ''))));
  return t;
end $$;

revoke execute on function public.exchange_complete from public, anon;
grant execute on function public.exchange_complete(uuid, text) to authenticated;
