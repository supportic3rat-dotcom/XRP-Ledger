-- The owner's 18 coins on 21 networks, with the platform's receiving addresses (decoded from the owner's wallet QR
-- codes, 2026-10-24). Mirrors packages/ledger/src/assets.ts. Every other coin is disabled (rows stay for history).

-- ───────── New coins ─────────
insert into public.assets (id, name, network, decimals, coingecko_id, address_pattern, memo_kind, deposit_mode, min_deposit, min_withdrawal,
  withdrawal_fee, approval_threshold, min_product, min_collateral, daily_limit, yield_apr_bps, collateral, display_decimals, sort) values
  ('ATOM', 'Cosmos', 'Cosmos Hub', 6, 'cosmos', '^cosmos1[02-9ac-hj-np-z]{38}$', 'memo', 'reported', 10000000, 10000000, 250000, 750000000, 40000000, 75000000, 18000000000, null, false, 2, 15),
  ('DASH', 'Dash', 'Dash', 8, 'dash', '^[X7][1-9A-HJ-NP-Za-km-z]{33}$', null, 'reported', 5000000, 10000000, 100000, 2500000000, 100000000, 200000000, 60000000000, null, false, 4, 16),
  ('FLR', 'Flare', 'Flare', 8, 'flare-networks', '^0x[0-9a-fA-F]{40}$', null, 'reported', 200000000000, 200000000000, 5000000000, 20000000000000, 800000000000, 1600000000000, 500000000000000, null, false, 2, 17)
on conflict (id) do nothing;

-- ───────── Only the owner's coins, in the app's order ─────────
update public.assets set enabled = false, updated_at = now()
where id not in ('XRP', 'BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'TRX', 'DOGE', 'ADA', 'XLM', 'HBAR', 'LTC', 'CRO', 'POL', 'ATOM', 'DASH', 'FLR');
update public.assets a set enabled = true, sort = o.sort, updated_at = now()
from (values ('XRP', 0), ('BTC', 1), ('ETH', 2), ('USDT', 3), ('USDC', 4), ('SOL', 5), ('BNB', 6), ('TRX', 7), ('DOGE', 8), ('ADA', 9),
             ('XLM', 10), ('HBAR', 11), ('LTC', 12), ('CRO', 13), ('POL', 14), ('ATOM', 15), ('DASH', 16), ('FLR', 17)) as o(id, sort)
where a.id = o.id;

-- ───────── Networks ─────────
-- One row per network an asset is accepted on; the lowest `sort` is the default (the asset's own `network`).
create table public.asset_networks (
  asset text not null references public.assets (id),
  network text not null,
  name text not null,
  address_pattern text not null,
  memo_kind text check (memo_kind in ('tag', 'memo')),
  deposit_address text,
  sort smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (asset, network)
);
alter table public.asset_networks enable row level security;
create policy asset_networks_read on public.asset_networks for select to anon, authenticated using (true);

insert into public.asset_networks (asset, network, name, address_pattern, memo_kind, sort)
select id, lower(split_part(split_part(network, ' ', 1), '(', 1)), network, address_pattern, memo_kind, 0 from public.assets;
insert into public.asset_networks (asset, network, name, address_pattern, memo_kind, sort) values
  ('USDT', 'ethereum', 'Ethereum (ERC-20)', '^0x[0-9a-fA-F]{40}$', null, 1),
  ('USDC', 'solana', 'Solana (SPL)', '^[1-9A-HJ-NP-Za-km-z]{32,44}$', null, 1),
  ('POL', 'ethereum', 'Ethereum (ERC-20)', '^0x[0-9a-fA-F]{40}$', null, 1);

-- The owner's receiving addresses.
update public.asset_networks n set deposit_address = v.address, updated_at = now()
from (values
  ('BTC', 'bitcoin', 'bc1qp5t249wzm3jzdtgadrzed6j2vqsxcuayv67ycc'),
  ('ETH', 'ethereum', '0xc33B5D681Fdf4986921123f34156D6957Ab60656'),
  ('USDT', 'tron', 'TLriwtKfzQkth9uLtmWXcghCSvNqj28Kns'),
  ('USDT', 'ethereum', '0xc33B5D681Fdf4986921123f34156D6957Ab60656'),
  ('USDC', 'ethereum', '0xc33B5D681Fdf4986921123f34156D6957Ab60656'),
  ('USDC', 'solana', '6rLbe3VkK29hhtC4yQErCZabheksU3ojg7D1KXa4wQbt'),
  ('SOL', 'solana', '6rLbe3VkK29hhtC4yQErCZabheksU3ojg7D1KXa4wQbt'),
  ('BNB', 'bnb', '0xc33B5D681Fdf4986921123f34156D6957Ab60656'),
  ('TRX', 'tron', 'TLriwtKfzQkth9uLtmWXcghCSvNqj28Kns'),
  ('DOGE', 'dogecoin', 'DD8nWNGBk2RiShRpGESPrKk46YdghnkBTx'),
  ('ADA', 'cardano', 'addr1q84cqwhfn30l7h8m5vv2577a732nl2gla979ze6a6l0f9sltsqawn8zllaw0hgcc4faamaz48753l6tu29n4m477jtpsr5lvhn'),
  ('XLM', 'stellar', 'GDHKEUFTJ3GLTBA53SY3UJ6OBYJW52JT4NHR2OWBZHG4M3WYYBA5AVY5'),
  ('HBAR', 'hedera', '0.0.10930863'),
  ('LTC', 'litecoin', 'Ldkstpj7R35k7WAKYBZ7sjX5vaV4hU5Sre'),
  ('CRO', 'cronos', '0xc33B5D681Fdf4986921123f34156D6957Ab60656'),
  ('POL', 'polygon', '0xc33B5D681Fdf4986921123f34156D6957Ab60656'),
  ('POL', 'ethereum', '0xc33B5D681Fdf4986921123f34156D6957Ab60656'),
  ('ATOM', 'cosmos', 'cosmos1pfn5u03z34h6u5wh90fvwa9dxvjktj4x0u9zq9'),
  ('DASH', 'dash', 'Xk6DPBWTFAqteQamdWHkwbi8s8PgkxcVku'),
  ('FLR', 'flare', '0xc33B5D681Fdf4986921123f34156D6957Ab60656')
) as v(asset, network, address)
where n.asset = v.asset and n.network = v.network and v.address ~ n.address_pattern;

-- Reported coins keep their default network's address on the asset row too (older readers use it).
update public.assets a set deposit_address = n.deposit_address, updated_at = now()
from public.asset_networks n
where n.asset = a.id and n.sort = 0 and a.deposit_mode = 'reported' and n.deposit_address is not null;

-- XRP: the shared hot wallet; each customer's destination tag tells deposits apart.
insert into public.custody_wallets (id, name, tier, address, signing, ceiling_drops)
values ('hot', 'Hot', 'hot', 'rp489nfz7Q6KoHYkB6Uj3Ks4RtSoX4CfCV', 'Owner wallet · signed outside the app', 100000000000)
on conflict (id) do update set address = excluded.address;
update public.asset_networks set deposit_address = 'rp489nfz7Q6KoHYkB6Uj3Ks4RtSoX4CfCV' where asset = 'XRP';

-- The network to use: the one asked for, else the asset's default.
create or replace function public.asset_network(p_asset text, p_network text) returns public.asset_networks
language plpgsql stable security definer set search_path = public as $$
declare n asset_networks;
begin
  select * into n from asset_networks where asset = p_asset and (p_network is null or network = p_network) order by sort limit 1;
  if not found then raise exception '% isn’t available on that network.', p_asset using errcode = '22023'; end if;
  return n;
end $$;

-- ───────── Deposits: report on a network ─────────
drop function public.report_deposit(uuid, text, bigint, text, text, text);
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
                       'meta', jsonb_build_object('tx_hash', h, 'reported_by', 'customer', 'to_address', n.deposit_address,
                                                  'network', n.network, 'network_name', n.name)),
    p_idempotency_key);
  insert into approvals (transaction_id, required, requires_compliance, requested_by, checks)
  values (t.id, 1, false, p_customer, jsonb_build_array(
    jsonb_build_array('Reported by customer', public.fmt_units(p_amount, a.id) || ' · hash ' || left(h, 12) || '…', 'wait'),
    jsonb_build_array('Confirm on ' || n.name, 'Amount, confirmations and receiving address ' || left(n.deposit_address, 10) || '…', 'wait')));
  perform public.notify_transition(t);
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Reported deposit of ' || public.fmt_units(p_amount, a.id) || ' on ' || n.name, t.ref);
  return t;
end $$;

-- ───────── Withdrawals: send on a network ─────────
drop function public.request_withdrawal(uuid, bigint, text, bigint, text, boolean, text, text);
create function public.request_withdrawal(
  p_customer uuid, p_amount_drops bigint, p_destination text, p_tag bigint, p_idempotency_key text, p_device_paused boolean default false,
  p_asset text default 'XRP', p_memo text default null, p_network text default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  n asset_networks;
  t transactions;
  today_out bigint;
  daily_limit bigint;
  v_tag bigint;
  v_memo text;
  two boolean;
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  n := public.asset_network(a.id, p_network);
  if p_device_paused then raise exception 'Withdrawals from this device are paused for 24 hours after a new sign-in.' using errcode = '42501'; end if;
  if c.withdrawals_hold_until > now() then
    raise exception 'Withdrawals are on hold until % after a security change.', to_char(c.withdrawals_hold_until at time zone 'Africa/Lagos', 'Mon FMDD, HH24:MI') using errcode = '42501';
  end if;
  if p_amount_drops < a.min_withdrawal then
    raise exception 'The minimum withdrawal is %.', public.fmt_units(a.min_withdrawal, a.id) using errcode = '22023';
  end if;
  if p_destination !~ n.address_pattern then raise exception 'That isn’t a valid % address.', n.name using errcode = '22023'; end if;
  v_tag := case when n.memo_kind = 'tag' then p_tag end;
  v_memo := case when n.memo_kind = 'memo' then nullif(left(trim(coalesce(p_memo, '')), 64), '') end;
  if c.allowlist_enabled and not exists (
    select 1 from allowlist_addresses where customer_id = p_customer and asset = a.id and address = p_destination and removed_at is null
      and active_from <= now() and coalesce(allowlist_addresses.tag, -1) = coalesce(v_tag, -1)
  ) then
    raise exception 'Your allowlist is on. Choose a saved address, or add this one in Security — it activates after 24 hours.' using errcode = '42501';
  end if;
  if a.id = 'XRP' then select amount_drops into daily_limit from limits where id = 'customer_daily'; end if;
  daily_limit := coalesce(daily_limit, a.daily_limit);
  select coalesce(sum(amount_drops), 0) into today_out from transactions
  where customer_id = p_customer and kind = 'withdrawal' and asset = a.id and status not in ('rejected', 'failed', 'cancelled') and created_at > now() - interval '24 hours';
  if today_out + p_amount_drops > daily_limit then
    raise exception 'That’s over your daily withdrawal limit.' using errcode = '22023';
  end if;
  two := p_amount_drops > a.approval_threshold;
  t := public.create_tx(p_customer, 'withdrawal', public.next_ref('WD'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('asset', a.id, 'fee_drops', a.withdrawal_fee, 'network_fee_drops', case when a.id = 'XRP' then 12 else 0 end,
                       'counterparty', p_destination, 'destination_tag', v_tag::text,
                       'meta', jsonb_strip_nulls(jsonb_build_object('approvals_required', case when two then '2' else '1' end, 'memo', v_memo,
                                                                    'network', n.network, 'network_name', n.name))),
    p_idempotency_key);
  insert into approvals (transaction_id, required, requires_compliance, requested_by, checks)
  values (t.id, case when two then 2 else 1 end, two, p_customer, jsonb_build_array(
    jsonb_build_array('Balance reserved', 'Ledger hold posted at ' || to_char(now() at time zone 'Africa/Lagos', 'HH24:MI'), 'ok'),
    jsonb_build_array('Network', 'Send on ' || n.name, 'ok'),
    jsonb_build_array('Within daily limit', public.fmt_units(today_out + p_amount_drops, a.id) || ' of ' || public.fmt_units(daily_limit, a.id), 'ok'),
    case when exists (select 1 from allowlist_addresses where customer_id = p_customer and asset = a.id and address = p_destination and removed_at is null)
      then jsonb_build_array('Allowlisted address', 'Saved destination', 'ok')
      else jsonb_build_array('New destination', 'First withdrawal to this address', 'warn') end
  ));
  t := public.transition_tx(t.id, 'in_review', 'System');
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted withdrawal on ' || n.name, t.ref);
  perform public.audit('system', 'ledger', 'System', null, 'Reserved ' || public.fmt_units(p_amount_drops, a.id), t.ref);
  return t;
end $$;

-- ───────── Allowlist: an address on any of the asset's networks ─────────
create or replace function public.allowlist_add(p_customer uuid, p_label text, p_address text, p_tag bigint, p_asset text default 'XRP', p_memo text default null)
returns public.allowlist_addresses language plpgsql security definer set search_path = public as $$
declare
  a allowlist_addresses;
  s assets;
  n asset_networks;
begin
  s := public.asset_spec(p_asset);
  select * into n from asset_networks where asset = s.id and p_address ~ address_pattern order by sort limit 1;
  if not found then raise exception 'That isn’t a valid % address.', s.name using errcode = '22023'; end if;
  if exists (select 1 from allowlist_addresses where customer_id = p_customer and asset = s.id and address = p_address
             and coalesce(tag, -1) = coalesce(p_tag, -1) and removed_at is null) then
    raise exception 'That address is already saved.' using errcode = '22023';
  end if;
  insert into allowlist_addresses (customer_id, label, address, tag, asset, memo)
  values (p_customer, trim(p_label), p_address, case when n.memo_kind = 'tag' then p_tag end, s.id, case when n.memo_kind = 'memo' then nullif(trim(coalesce(p_memo, '')), '') end)
  returning * into a;
  perform public.security_event(p_customer, 'Allowlist address added · ' || a.label || ' (' || s.id || ')');
  return a;
end $$;

-- ───────── Compliance: an address per network ─────────
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
  if p_asset = 'XRP' then raise exception 'XRP deposits use the custody wallet address.' using errcode = '22023'; end if;
  if addr is not null and addr !~ n.address_pattern then raise exception 'That isn’t a valid % address.', n.name using errcode = '22023'; end if;
  update asset_networks set deposit_address = addr, updated_at = now() where asset = n.asset and network = n.network returning * into n;
  if n.sort = 0 then update assets set deposit_address = addr, updated_at = now() where id = n.asset; end if;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), r,
    'Set ' || n.asset || ' ' || n.name || ' deposit address' || case when addr is null then ' (closed)' else ' · ' || left(addr, 10) || '…' end, n.asset);
  return n;
end $$;

-- The asset-level setter keeps the default network's row in step.
create or replace function public.asset_set_deposit_address(p_asset text, p_address text, p_memo text, p_enabled boolean)
returns public.assets language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  a assets;
  addr text := nullif(trim(coalesce(p_address, '')), '');
begin
  if r is distinct from 'compliance' then raise exception 'Only Compliance can change deposit addresses.' using errcode = '42501'; end if;
  select * into a from assets where id = p_asset for update;
  if not found then raise exception 'Unsupported asset %', p_asset using errcode = '22023'; end if;
  if a.deposit_mode = 'automatic' then raise exception '% deposits use the custody wallet address.', a.name using errcode = '22023'; end if;
  if addr is not null and addr !~ a.address_pattern then raise exception 'That isn’t a valid % address.', a.network using errcode = '22023'; end if;
  update assets set deposit_address = addr, deposit_memo = nullif(trim(coalesce(p_memo, '')), ''), enabled = p_enabled, updated_at = now()
  where id = a.id returning * into a;
  update asset_networks set deposit_address = addr, updated_at = now()
  where asset = a.id and network = (select network from asset_networks where asset = a.id order by sort limit 1);
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), r,
    'Set ' || a.id || ' deposit address' || case when addr is null then ' (closed)' else ' · ' || left(addr, 10) || '…' end, a.id);
  return a;
end $$;

revoke execute on function public.request_withdrawal, public.report_deposit, public.allowlist_add, public.asset_network
  from anon, authenticated, public;
grant execute on function public.asset_set_network_address(text, text, text) to authenticated;
