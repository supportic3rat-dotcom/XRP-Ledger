-- XRP goes through the same path as the other coins (owner's decision, 2026-10-25): the customer sends to the shared
-- address with their destination tag and reports the hash; staff confirm it and approve the credit. Withdrawals are
-- sent by staff from the owner's wallet and marked sent. The XRPL worker's automatic path stays in the code for when
-- `deposit_mode` is set back to 'automatic'.

update public.assets
set deposit_mode = 'reported',
    deposit_address = (select deposit_address from public.asset_networks where asset = 'XRP' order by sort limit 1),
    updated_at = now()
where id = 'XRP';

-- A reported deposit to a shared address (XRP) is only the reporter's if it carries their destination tag.
drop function public.report_deposit(uuid, text, bigint, text, text, text, text);
create function public.report_deposit(
  p_customer uuid, p_asset text, p_amount bigint, p_tx_hash text, p_from text, p_idempotency_key text, p_network text default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  n asset_networks;
  t transactions;
  h text := trim(coalesce(p_tx_hash, ''));
begin
  c := public.assert_customer_can_transact(p_customer);
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

-- Staff send any staff-confirmed coin's withdrawals (only 'automatic' coins belong to the custody integration).
create or replace function public.withdrawal_mark_sent(p_tx uuid, p_hash text) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  who text := coalesce(public.staff_name(), 'Staff');
  t transactions;
  h text := trim(coalesce(p_hash, ''));
begin
  if r is null or r not in ('operations', 'compliance') then raise exception 'Read-only role: you can view but not act.' using errcode = '42501'; end if;
  select * into t from transactions where id = p_tx and kind = 'withdrawal' for update;
  if not found then raise exception 'Withdrawal not found' using errcode = 'P0002'; end if;
  if (select deposit_mode from assets where id = t.asset) = 'automatic' then
    raise exception '% withdrawals are sent by the custody integration.', t.asset using errcode = '22023';
  end if;
  if t.status <> 'approved' then raise exception 'Only approved withdrawals can be marked as sent.' using errcode = '22023'; end if;
  if length(h) < 8 then raise exception 'Enter the transaction hash from the network.' using errcode = '22023'; end if;
  update transactions set ledger_hash = h where id = t.id;
  perform public.transition_tx(t.id, 'submitted', who, 'Sent from platform wallet', jsonb_build_object('tx_hash', h));
  t := public.transition_tx(t.id, 'validated', who, 'Confirmed on ' || coalesce(t.meta->>'network_name', (select network from assets where id = t.asset)));
  perform public.audit('staff', auth.uid()::text, who, r, 'Marked withdrawal sent · ' || public.fmt_units(t.amount_drops, t.asset), t.ref, jsonb_build_object('hash', h));
  return t;
end $$;

create or replace function public.withdrawal_mark_failed(p_tx uuid, p_reason text) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  who text := coalesce(public.staff_name(), 'Staff');
  t transactions;
begin
  if r is null or r not in ('operations', 'compliance') then raise exception 'Read-only role: you can view but not act.' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 10 then raise exception 'Write a short reason — it goes into the audit log.' using errcode = '22023'; end if;
  select * into t from transactions where id = p_tx and kind = 'withdrawal' for update;
  if not found then raise exception 'Withdrawal not found' using errcode = 'P0002'; end if;
  if (select deposit_mode from assets where id = t.asset) = 'automatic' then
    raise exception '% withdrawals are handled by the custody integration.', t.asset using errcode = '22023';
  end if;
  if t.status <> 'approved' then raise exception 'Only approved withdrawals can be marked as failed.' using errcode = '22023'; end if;
  t := public.transition_tx(t.id, 'failed', who, p_reason);
  perform public.audit('staff', auth.uid()::text, who, r, 'Marked withdrawal failed · funds returned', t.ref, jsonb_build_object('reason', p_reason));
  return t;
end $$;

-- Compliance can now set XRP's receiving address too (it is no longer tied to the custody wallet).
create or replace function public.asset_set_network_address(p_asset text, p_network text, p_address text)
returns public.asset_networks language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  n asset_networks;
  addr text := nullif(trim(coalesce(p_address, '')), '');
begin
  if r is distinct from 'compliance' then raise exception 'Only Compliance can change deposit addresses.' using errcode = '42501'; end if;
  select * into n from asset_networks where asset = p_asset and network = p_network for update;
  if not found then raise exception '% isn’t available on that network.', p_asset using errcode = '22023'; end if;
  if (select deposit_mode from assets where id = p_asset) = 'automatic' then
    raise exception '% deposits use the custody wallet address.', p_asset using errcode = '22023';
  end if;
  if addr is not null and addr !~ n.address_pattern then raise exception 'That isn’t a valid % address.', n.name using errcode = '22023'; end if;
  update asset_networks set deposit_address = addr, updated_at = now() where asset = n.asset and network = n.network returning * into n;
  if n.sort = 0 then update assets set deposit_address = addr, updated_at = now() where id = n.asset; end if;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), r,
    'Set ' || n.asset || ' ' || n.name || ' deposit address' || case when addr is null then ' (closed)' else ' · ' || left(addr, 10) || '…' end, n.asset);
  return n;
end $$;

revoke execute on function public.report_deposit from anon, authenticated, public;
