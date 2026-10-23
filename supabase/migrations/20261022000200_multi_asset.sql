-- Multi-asset support. Every ledger account, transaction, yield position, loan and allowlist entry now carries an asset.
-- Amount columns keep their historical *_drops names but hold base units of the row's asset at its ledger precision
-- (`assets.decimals`, at most 8, so balances fit a bigint). XRP keeps 6 (drops). Mirrors packages/ledger/src/assets.ts.
--
-- XRP deposits stay automatic (destination tag on the omnibus address, matched by the XRPL worker). Other assets are
-- `reported`: the customer sends to the address staff configured and reports the transaction; a second person confirms
-- it on the network and approves the credit in the queue. Non-XRP withdrawals are sent by staff after approval and
-- marked sent with the network hash.

-- ───────── Asset registry ─────────
create table public.assets (
  id text primary key,
  name text not null,
  network text not null,
  decimals smallint not null check (decimals between 0 and 8),
  coingecko_id text not null,
  address_pattern text not null,
  memo_kind text check (memo_kind in ('tag', 'memo')),
  deposit_mode text not null check (deposit_mode in ('automatic', 'reported')),
  min_deposit bigint not null check (min_deposit > 0),
  min_withdrawal bigint not null check (min_withdrawal > 0),
  withdrawal_fee bigint not null check (withdrawal_fee >= 0),
  approval_threshold bigint not null check (approval_threshold > 0),
  min_product bigint not null check (min_product > 0),
  min_collateral bigint not null check (min_collateral > 0),
  daily_limit bigint not null check (daily_limit > 0),
  yield_apr_bps int check (yield_apr_bps is null or yield_apr_bps between 0 and 10000),
  collateral boolean not null default false,
  display_decimals smallint not null default 2,
  sort smallint not null,
  -- Where customers send this asset (set by staff). Null means deposits aren't open yet. XRP uses the hot custody wallet.
  deposit_address text,
  deposit_memo text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.assets (id, name, network, decimals, coingecko_id, address_pattern, memo_kind, deposit_mode, min_deposit, min_withdrawal,
  withdrawal_fee, approval_threshold, min_product, min_collateral, daily_limit, yield_apr_bps, collateral, display_decimals, sort) values
  ('XRP', 'XRP', 'XRP Ledger', 6, 'ripple', '^r[1-9A-HJ-NP-Za-km-z]{24,34}$', 'tag', 'automatic', 10000000, 10000000, 250000, 1000000000, 50000000, 100000000, 25000000000, 300, true, 2, 1),
  ('BTC', 'Bitcoin', 'Bitcoin', 8, 'bitcoin', '^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$', null, 'reported', 10000, 20000, 5000, 3000000, 100000, 200000, 60000000, 150, true, 6, 2),
  ('ETH', 'Ethereum', 'Ethereum', 8, 'ethereum', '^0x[0-9a-fA-F]{40}$', null, 'reported', 500000, 1000000, 200000, 80000000, 3000000, 6000000, 1500000000, 250, true, 5, 3),
  ('USDT', 'Tether', 'Tron (TRC-20)', 6, 'tether', '^T[1-9A-HJ-NP-Za-km-z]{33}$', null, 'reported', 10000000, 20000000, 1000000, 2500000000, 100000000, 250000000, 60000000000, 600, true, 2, 4),
  ('USDC', 'USD Coin', 'Ethereum (ERC-20)', 6, 'usd-coin', '^0x[0-9a-fA-F]{40}$', null, 'reported', 10000000, 20000000, 3000000, 2500000000, 100000000, 250000000, 60000000000, 550, true, 2, 5),
  ('SOL', 'Solana', 'Solana', 8, 'solana', '^[1-9A-HJ-NP-Za-km-z]{32,44}$', null, 'reported', 5000000, 10000000, 1000000, 1500000000, 50000000, 100000000, 35000000000, 500, true, 3, 6),
  ('BNB', 'BNB', 'BNB Smart Chain (BEP-20)', 8, 'binancecoin', '^0x[0-9a-fA-F]{40}$', null, 'reported', 1000000, 2000000, 50000, 400000000, 10000000, 20000000, 9000000000, 200, true, 4, 7),
  ('ADA', 'Cardano', 'Cardano', 6, 'cardano', '^addr1[0-9a-z]{53,110}$', null, 'reported', 10000000, 20000000, 1000000, 4000000000, 150000000, 300000000, 90000000000, 300, true, 2, 8),
  ('DOGE', 'Dogecoin', 'Dogecoin', 8, 'dogecoin', '^D[1-9A-HJ-NP-Za-km-z]{25,34}$', null, 'reported', 2000000000, 5000000000, 400000000, 1200000000000, 50000000000, 100000000000, 30000000000000, 150, false, 2, 9),
  ('TRX', 'TRON', 'Tron', 6, 'tron', '^T[1-9A-HJ-NP-Za-km-z]{33}$', null, 'reported', 20000000, 50000000, 1000000, 10000000000, 300000000, 600000000, 250000000000, 400, false, 2, 10),
  ('LTC', 'Litecoin', 'Litecoin', 8, 'litecoin', '^(ltc1[02-9ac-hj-np-z]{11,71}|[LM3][1-9A-HJ-NP-Za-km-z]{26,33})$', null, 'reported', 5000000, 10000000, 100000, 2500000000, 100000000, 200000000, 60000000000, 150, true, 4, 11),
  ('AVAX', 'Avalanche', 'Avalanche C-Chain', 8, 'avalanche-2', '^0x[0-9a-fA-F]{40}$', null, 'reported', 10000000, 50000000, 1000000, 10000000000, 400000000, 800000000, 250000000000, 450, false, 3, 12),
  ('DOT', 'Polkadot', 'Polkadot', 8, 'polkadot', '^1[1-9A-HJ-NP-Za-km-z]{45,47}$', null, 'reported', 100000000, 200000000, 10000000, 50000000000, 2000000000, 4000000000, 1200000000000, 1000, false, 3, 13),
  ('LINK', 'Chainlink', 'Ethereum (ERC-20)', 8, 'chainlink', '^0x[0-9a-fA-F]{40}$', null, 'reported', 50000000, 100000000, 20000000, 15000000000, 600000000, 1200000000, 350000000000, 350, false, 3, 14),
  ('XLM', 'Stellar', 'Stellar', 7, 'stellar', '^G[A-Z2-7]{55}$', 'memo', 'reported', 100000000, 200000000, 5000000, 80000000000, 3000000000, 6000000000, 2000000000000, 200, false, 2, 15),
  ('TON', 'Toncoin', 'TON', 8, 'the-open-network', '^(EQ|UQ)[A-Za-z0-9_-]{46}$', 'memo', 'reported', 100000000, 200000000, 5000000, 60000000000, 2000000000, 4000000000, 1500000000000, 400, false, 3, 16),
  ('BCH', 'Bitcoin Cash', 'Bitcoin Cash', 8, 'bitcoin-cash', '^((bitcoincash:)?[qp][a-z0-9]{41}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$', null, 'reported', 1000000, 2000000, 50000, 500000000, 20000000, 40000000, 12000000000, null, false, 4, 17),
  ('POL', 'Polygon', 'Polygon PoS', 8, 'polygon-ecosystem-token', '^0x[0-9a-fA-F]{40}$', null, 'reported', 500000000, 1000000000, 10000000, 1000000000000, 30000000000, 60000000000, 25000000000000, 350, false, 2, 18);

alter table public.assets enable row level security;
create policy assets_read on public.assets for select to anon, authenticated using (true);

-- Asset row for a money action; refuses unknown or disabled assets.
create or replace function public.asset_spec(p_asset text) returns public.assets
language plpgsql stable security definer set search_path = public as $$
declare
  a assets;
begin
  select * into a from assets where id = p_asset;
  if not found then raise exception 'Unsupported asset %', p_asset using errcode = '22023'; end if;
  if not a.enabled then raise exception '% isn’t available right now.', a.name using errcode = '22023'; end if;
  return a;
end $$;

-- "1,250.00 XRP" / "0.0125 BTC": at least 2 decimals, up to the asset's display decimals.
create or replace function public.fmt_units(p_units bigint, p_asset text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  d int;
  dd int;
begin
  select decimals, display_decimals into d, dd from assets where id = p_asset;
  d := coalesce(d, 6);
  dd := greatest(coalesce(dd, 2), 2);
  return to_char(p_units::numeric / power(10, d), 'FM999,999,999,999,990.' || '00' || repeat('9', dd - 2)) || ' ' || p_asset;
end $$;

-- ───────── Ledger: per-asset accounts and balance checks ─────────
alter table public.ledger_accounts drop constraint if exists ledger_accounts_asset_check;

create or replace function public.ledger_account(p_customer uuid, p_kind public.account_kind, p_asset text default 'XRP')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  acc uuid;
begin
  if p_asset <> 'USD' and not exists (select 1 from assets where id = p_asset) then
    raise exception 'Unsupported asset %', p_asset using errcode = '22023';
  end if;
  select id into acc from ledger_accounts
  where coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_customer, '00000000-0000-0000-0000-000000000000'::uuid)
    and kind = p_kind and asset = p_asset;
  if acc is null then
    insert into ledger_accounts (customer_id, kind, asset) values (p_customer, p_kind, p_asset)
    on conflict do nothing returning id into acc;
    if acc is null then
      return public.ledger_account(p_customer, p_kind, p_asset);
    end if;
  end if;
  return acc;
end $$;

-- Every entry balances to zero within each asset.
create or replace function public.check_entry_balanced() returns trigger
language plpgsql as $$
declare
  n int;
  bad text;
begin
  select count(*) into n from public.journal_lines where entry_id = new.entry_id;
  if n < 2 then
    raise exception 'Journal entry % has fewer than two lines', new.entry_id using errcode = '23514';
  end if;
  select a.asset into bad
  from public.journal_lines l join public.ledger_accounts a on a.id = l.account_id
  where l.entry_id = new.entry_id
  group by a.asset having sum(l.amount_drops) <> 0
  limit 1;
  if bad is not null then
    raise exception 'Journal entry % is not balanced in %', new.entry_id, bad using errcode = '23514';
  end if;
  return null;
end $$;

-- p_lines: [{"customer": uuid|null, "kind": "available", "amount": "-123", "asset": "BTC"}] (asset defaults to XRP).
create or replace function public.post_entry(
  p_kind text, p_reference text, p_transaction uuid, p_created_by text, p_lines jsonb,
  p_reason text default null, p_reverses uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  entry uuid;
  line jsonb;
  acc uuid;
  touched uuid[] := '{}';
  bal bigint;
begin
  insert into journal_entries (kind, reference, transaction_id, created_by, reason, reverses_entry_id)
  values (p_kind, p_reference, p_transaction, p_created_by, p_reason, p_reverses)
  returning id into entry;

  for line in select * from jsonb_array_elements(p_lines) loop
    acc := public.ledger_account(nullif(line->>'customer', '')::uuid, (line->>'kind')::account_kind, coalesce(line->>'asset', 'XRP'));
    perform 1 from ledger_accounts where id = acc for update;
    insert into journal_lines (entry_id, account_id, amount_drops) values (entry, acc, (line->>'amount')::bigint);
    touched := touched || acc;
  end loop;

  for acc in select distinct unnest(touched) loop
    if exists (select 1 from ledger_accounts where id = acc and customer_id is not null) then
      bal := public.account_balance(acc);
      if bal < 0 then
        raise exception 'Insufficient balance on account % (would be % units)', acc, bal using errcode = '23514';
      end if;
    end if;
  end loop;
  return entry;
end $$;

-- ───────── Transactions carry an asset (and, for swaps, the asset received) ─────────
alter table public.transactions add column asset text not null default 'XRP' references public.assets (id);
alter table public.transactions add column counter_asset text references public.assets (id);
alter table public.transactions add column counter_amount bigint check (counter_amount is null or counter_amount > 0);
create index on public.transactions (customer_id, asset);

create or replace function public.jl(p_customer text, p_kind text, p_amount bigint, p_asset text) returns jsonb
language sql immutable as $$
  select jsonb_build_object('customer', p_customer, 'kind', p_kind, 'amount', p_amount::text, 'asset', p_asset)
$$;

-- Journal lines for each transition, in the transaction's asset. Mirrors packages/ledger/src/journal.ts.
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
      return jsonb_build_array(public.jl(null, 'provider_receivable', amt, a), public.jl(c, 'available', -(amt - fee), a), public.jl(null, 'fee_revenue', -fee, a));
    when 'loan:collateral_locked' then
      return jsonb_build_array(public.jl(c, 'available', amt, a), public.jl(c, 'collateral', -amt, a));
    when 'loan_collateral:recorded' then
      return jsonb_build_array(public.jl(c, 'available', amt, a), public.jl(c, 'reserved', -amt, a));
    when 'loan_collateral:lock_confirmed' then
      return jsonb_build_array(public.jl(c, 'reserved', amt, a), public.jl(c, 'collateral', -amt, a));
    when 'loan_collateral:failed' then
      return jsonb_build_array(public.jl(c, 'reserved', amt, a), public.jl(c, 'available', -amt, a));
    when 'loan:repaid' then
      return jsonb_build_array(public.jl(c, 'collateral', amt, a), public.jl(c, 'available', -amt, a));
    else
      return '[]'::jsonb;
  end case;
end $$;

create or replace function public.create_tx(
  p_customer uuid, p_kind public.tx_kind, p_ref text, p_initial text, p_amount_drops bigint, p_actor text,
  p_fields jsonb default '{}'::jsonb, p_idempotency_key text default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  t transactions;
  lines jsonb;
begin
  insert into transactions (ref, customer_id, kind, status, asset, counter_asset, amount_drops, amount_cents, fee_drops, network_fee_drops,
                            counterparty, destination_tag, loan_id, idempotency_key, meta)
  values (p_ref, p_customer, p_kind, p_initial, coalesce(nullif(p_fields->>'asset', ''), 'XRP'), nullif(p_fields->>'counter_asset', ''),
          p_amount_drops, nullif(p_fields->>'amount_cents', '')::bigint,
          coalesce((p_fields->>'fee_drops')::bigint, 0), coalesce((p_fields->>'network_fee_drops')::bigint, 0),
          p_fields->>'counterparty', nullif(p_fields->>'destination_tag', '')::bigint, nullif(p_fields->>'loan_id', '')::uuid,
          p_idempotency_key, coalesce(p_fields->'meta', '{}'::jsonb))
  returning * into t;
  insert into transaction_events (transaction_id, from_status, to_status, actor) values (t.id, null, p_initial, p_actor);
  lines := public.journal_lines_for(t, p_initial);
  if jsonb_array_length(lines) > 0 then
    perform public.post_entry(p_kind::text || ':' || p_initial, p_ref, t.id, p_actor, lines);
  end if;
  return t;
end $$;

-- Reported deposits: customer (or staff) reports → staff confirm on the network → credited, or rejected.
insert into public.tx_transitions (kind, from_status, to_status) values
  ('deposit', 'reported', 'validated'), ('deposit', 'reported', 'rejected');

create or replace function public.notify_transition(t public.transactions) returns void
language plpgsql security definer set search_path = public as $$
declare
  amt text := public.fmt_units(coalesce(t.amount_drops, 0), t.asset);
  net text := (select network from assets where id = t.asset);
begin
  case t.kind::text || ':' || t.status
    when 'deposit:detected' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'warn', 'recv', 'Deposit detected', amt || ' is waiting for ledger validation. It’s not in your balance yet.', '/');
    when 'deposit:reported' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'warn', 'recv', 'Deposit reported', 'We’re confirming your ' || amt || ' deposit on the ' || net || ' network. It’s not in your balance yet.', '/');
    when 'deposit:credited' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'ok', 'recv', 'Deposit credited', amt || ' is now in your available balance.', '/');
    when 'deposit:rejected' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'bad', 'alert', 'Deposit not confirmed', 'We couldn’t confirm ' || t.ref || ' on the ' || net || ' network. Contact support with your transaction hash.', '/support');
    when 'withdrawal:validated' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'ok', 'recv', 'Withdrawal completed',
              amt || case when t.asset = 'XRP' then ' was validated on the XRP Ledger.' else ' was sent on the ' || net || ' network.' end, '/');
    when 'withdrawal:rejected' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'bad', 'alert', 'Withdrawal rejected', t.ref || ' was rejected. The reserved ' || t.asset || ' is back in your available balance.', '/');
    when 'exchange:quoted' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'warn', 'ex', 'Firm quote ready', 'Accept the quote for ' || t.ref || ' before it expires.', '/exchange');
    when 'exchange:rejected' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'bad', 'ex', 'Exchange request rejected', t.ref || ' was rejected: ' || coalesce(t.meta->>'reason', 'see details') || '. No ' || t.asset || ' was reserved.', '/');
    when 'exchange:paid_out' then
      if t.counter_asset is not null then
        insert into notifications (customer_id, type, tone, icon, title, body, link)
        values (t.customer_id, 'tx', 'ok', 'ex', 'Swap completed', public.fmt_units(t.counter_amount, t.counter_asset) || ' is now in your available balance.', '/');
      end if;
    when 'yield_reward:credited' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'ok', 'coin', 'Yield reward credited',
              public.fmt_units(t.amount_drops - t.fee_drops, t.asset) || ' from ' || t.asset || ' Flexible is now in your available balance.', '/earn');
    else
      null;
  end case;
end $$;

-- ───────── Deposits (reported assets) ─────────
create or replace function public.report_deposit(
  p_customer uuid, p_asset text, p_amount bigint, p_tx_hash text, p_from text, p_idempotency_key text
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  t transactions;
  h text := trim(coalesce(p_tx_hash, ''));
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  if a.deposit_mode <> 'reported' then
    raise exception '% deposits are credited automatically once validated.', a.name using errcode = '22023';
  end if;
  if a.deposit_address is null then raise exception '% deposits aren’t open yet.', a.name using errcode = '22023'; end if;
  if p_amount < a.min_deposit then raise exception 'The minimum deposit is %.', public.fmt_units(a.min_deposit, a.id) using errcode = '22023'; end if;
  if length(h) < 8 or h !~ '^[A-Za-z0-9:_-]+$' then raise exception 'Enter the transaction hash (ID) from your wallet.' using errcode = '22023'; end if;
  if exists (select 1 from transactions where kind = 'deposit' and asset = a.id and meta->>'tx_hash' = h and status <> 'rejected') then
    raise exception 'That transaction has already been reported.' using errcode = '22023';
  end if;
  t := public.create_tx(p_customer, 'deposit', public.next_ref('DEP'), 'reported', p_amount, 'Customer',
    jsonb_build_object('asset', a.id, 'counterparty', nullif(trim(coalesce(p_from, '')), ''),
                       'meta', jsonb_build_object('tx_hash', h, 'reported_by', 'customer', 'to_address', a.deposit_address)),
    p_idempotency_key);
  insert into approvals (transaction_id, required, requires_compliance, requested_by, checks)
  values (t.id, 1, false, p_customer, jsonb_build_array(
    jsonb_build_array('Reported by customer', public.fmt_units(p_amount, a.id) || ' · hash ' || left(h, 12) || '…', 'wait'),
    jsonb_build_array('Confirm on ' || a.network, 'Amount, confirmations and receiving address ' || left(a.deposit_address, 10) || '…', 'wait')));
  perform public.notify_transition(t);
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Reported deposit of ' || public.fmt_units(p_amount, a.id), t.ref);
  return t;
end $$;

-- Staff record a deposit they've seen arrive for a customer; a different staff member approves the credit.
create or replace function public.staff_record_deposit(p_customer uuid, p_asset text, p_amount bigint, p_tx_hash text, p_note text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  who text := coalesce(public.staff_name(), 'Staff');
  a assets;
  c customers;
  t transactions;
  h text := trim(coalesce(p_tx_hash, ''));
begin
  if r is null or r not in ('operations', 'compliance') then raise exception 'Read-only role: you can view but not act.' using errcode = '42501'; end if;
  a := public.asset_spec(p_asset);
  select * into c from customers where id = p_customer;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;
  if p_amount <= 0 then raise exception 'Enter the amount received.' using errcode = '22023'; end if;
  if length(h) < 8 then raise exception 'Enter the transaction hash from the network.' using errcode = '22023'; end if;
  if exists (select 1 from transactions where kind = 'deposit' and asset = a.id and (meta->>'tx_hash' = h or ledger_hash = h) and status <> 'rejected') then
    raise exception 'That transaction is already recorded.' using errcode = '22023';
  end if;
  t := public.create_tx(p_customer, 'deposit', public.next_ref('DEP'), 'reported', p_amount, who,
    jsonb_build_object('asset', a.id, 'meta', jsonb_build_object('tx_hash', h, 'reported_by', 'staff', 'note', coalesce(p_note, ''))));
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, auth.uid(), jsonb_build_array(
    jsonb_build_array('Recorded by ' || who, public.fmt_units(p_amount, a.id) || ' · hash ' || left(h, 12) || '…', 'ok'),
    jsonb_build_array('Second-person check', 'Confirm on ' || a.network || ' before approving', 'wait')));
  perform public.audit('staff', auth.uid()::text, who, r, 'Recorded deposit of ' || public.fmt_units(p_amount, a.id) || ' for approval', t.ref);
  return t;
end $$;

-- ───────── Withdrawals ─────────
alter table public.allowlist_addresses drop constraint if exists allowlist_addresses_address_check;
alter table public.allowlist_addresses add column asset text not null default 'XRP' references public.assets (id);
alter table public.allowlist_addresses add column memo text;

drop function public.request_withdrawal(uuid, bigint, text, bigint, text, boolean);
create function public.request_withdrawal(
  p_customer uuid, p_amount_drops bigint, p_destination text, p_tag bigint, p_idempotency_key text, p_device_paused boolean default false,
  p_asset text default 'XRP', p_memo text default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  t transactions;
  today_out bigint;
  daily_limit bigint;
  v_tag bigint;
  v_memo text;
  two boolean;
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  if p_device_paused then raise exception 'Withdrawals from this device are paused for 24 hours after a new sign-in.' using errcode = '42501'; end if;
  if c.withdrawals_hold_until > now() then
    raise exception 'Withdrawals are on hold until % after a security change.', to_char(c.withdrawals_hold_until at time zone 'Africa/Lagos', 'Mon FMDD, HH24:MI') using errcode = '42501';
  end if;
  if p_amount_drops < a.min_withdrawal then
    raise exception 'The minimum withdrawal is %.', public.fmt_units(a.min_withdrawal, a.id) using errcode = '22023';
  end if;
  if p_destination !~ a.address_pattern then raise exception 'That isn’t a valid % address.', a.network using errcode = '22023'; end if;
  v_tag := case when a.memo_kind = 'tag' then p_tag end;
  v_memo := case when a.memo_kind = 'memo' then nullif(left(trim(coalesce(p_memo, '')), 64), '') end;
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
                       'meta', jsonb_strip_nulls(jsonb_build_object('approvals_required', case when two then '2' else '1' end, 'memo', v_memo))),
    p_idempotency_key);
  insert into approvals (transaction_id, required, requires_compliance, requested_by, checks)
  values (t.id, case when two then 2 else 1 end, two, p_customer, jsonb_build_array(
    jsonb_build_array('Balance reserved', 'Ledger hold posted at ' || to_char(now() at time zone 'Africa/Lagos', 'HH24:MI'), 'ok'),
    jsonb_build_array('2FA confirmed by customer', 'Authenticator, ' || to_char(now() at time zone 'Africa/Lagos', 'HH24:MI'), 'ok'),
    jsonb_build_array('Within daily limit', public.fmt_units(today_out + p_amount_drops, a.id) || ' of ' || public.fmt_units(daily_limit, a.id), 'ok'),
    case when exists (select 1 from allowlist_addresses where customer_id = p_customer and asset = a.id and address = p_destination and removed_at is null)
      then jsonb_build_array('Allowlisted address', 'Saved destination', 'ok')
      else jsonb_build_array('New destination', 'First withdrawal to this address', 'warn') end
  ));
  t := public.transition_tx(t.id, 'in_review', 'System');
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted withdrawal (2FA verified)', t.ref);
  perform public.audit('system', 'ledger', 'System', null, 'Reserved ' || public.fmt_units(p_amount_drops, a.id), t.ref);
  return t;
end $$;

-- Non-XRP withdrawals are sent by staff from the asset's wallet after approval, then marked sent with the network hash.
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
  if t.asset = 'XRP' then raise exception 'XRP withdrawals are sent by the custody integration.' using errcode = '22023'; end if;
  if t.status <> 'approved' then raise exception 'Only approved withdrawals can be marked as sent.' using errcode = '22023'; end if;
  if length(h) < 8 then raise exception 'Enter the transaction hash from the network.' using errcode = '22023'; end if;
  update transactions set ledger_hash = h where id = t.id;
  perform public.transition_tx(t.id, 'submitted', who, 'Sent from platform wallet', jsonb_build_object('tx_hash', h));
  t := public.transition_tx(t.id, 'validated', who, 'Confirmed on ' || (select network from assets where id = t.asset));
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
  if t.asset = 'XRP' then raise exception 'XRP withdrawals are handled by the custody integration.' using errcode = '22023'; end if;
  if t.status <> 'approved' then raise exception 'Only approved withdrawals can be marked as failed.' using errcode = '22023'; end if;
  t := public.transition_tx(t.id, 'failed', who, p_reason);
  perform public.audit('staff', auth.uid()::text, who, r, 'Marked withdrawal failed · funds returned', t.ref, jsonb_build_object('reason', p_reason));
  return t;
end $$;

drop function public.allowlist_add(uuid, text, text, bigint);
create function public.allowlist_add(p_customer uuid, p_label text, p_address text, p_tag bigint, p_asset text default 'XRP', p_memo text default null)
returns public.allowlist_addresses language plpgsql security definer set search_path = public as $$
declare
  a allowlist_addresses;
  s assets;
begin
  s := public.asset_spec(p_asset);
  if p_address !~ s.address_pattern then raise exception 'That isn’t a valid % address.', s.network using errcode = '22023'; end if;
  if exists (select 1 from allowlist_addresses where customer_id = p_customer and asset = s.id and address = p_address
             and coalesce(tag, -1) = coalesce(p_tag, -1) and removed_at is null) then
    raise exception 'That address is already saved.' using errcode = '22023';
  end if;
  insert into allowlist_addresses (customer_id, label, address, tag, asset, memo)
  values (p_customer, trim(p_label), p_address, case when s.memo_kind = 'tag' then p_tag end, s.id, case when s.memo_kind = 'memo' then nullif(trim(coalesce(p_memo, '')), '') end)
  returning * into a;
  perform public.security_event(p_customer, 'Allowlist address added · ' || a.label || ' (' || s.id || ')');
  return a;
end $$;

-- ───────── Exchange: sell for USD, or swap into another asset ─────────
alter table public.quotes add column receive_units bigint check (receive_units is null or receive_units > 0);

drop function public.request_exchange(uuid, bigint, bigint, text);
create function public.request_exchange(
  p_customer uuid, p_amount_drops bigint, p_indicative_cents bigint, p_idempotency_key text, p_asset text default 'XRP', p_to_asset text default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  b assets;
  t transactions;
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  if p_to_asset is not null then
    b := public.asset_spec(p_to_asset);
    if b.id = a.id then raise exception 'Choose a different asset to receive.' using errcode = '22023'; end if;
  end if;
  if p_amount_drops < a.min_product then raise exception 'The minimum request is %.', public.fmt_units(a.min_product, a.id) using errcode = '22023'; end if;
  if public.account_balance(public.ledger_account(p_customer, 'available', a.id)) < p_amount_drops then
    raise exception 'That’s more than your available balance.' using errcode = '22023';
  end if;
  t := public.create_tx(p_customer, 'exchange', public.next_ref('EX'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('asset', a.id, 'counter_asset', p_to_asset,
                       'meta', jsonb_build_object('indicative_cents', p_indicative_cents::text, 'receive', coalesce(p_to_asset, 'USD'))),
    p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, p_customer, jsonb_build_array(
    jsonb_build_array('Customer eligible', 'Verified, within exchange limits', 'ok'),
    jsonb_build_array(case when p_to_asset is null then 'Sell ' || a.id || ' for USD' else 'Swap ' || a.id || ' → ' || p_to_asset end, public.fmt_units(p_amount_drops, a.id), 'ok'),
    jsonb_build_array('Liquidity provider quote', 'Not requested yet', 'wait')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted exchange request', t.ref);
  return t;
end $$;

drop function public.record_quote(uuid, bigint, bigint, bigint, timestamptz);
create function public.record_quote(p_tx uuid, p_price_micro bigint, p_fee_cents bigint, p_receive_cents bigint, p_expires_at timestamptz, p_receive_units bigint default null)
returns public.quotes language plpgsql security definer set search_path = public as $$
declare
  q quotes;
begin
  insert into quotes (transaction_id, price_micro, fee_cents, receive_cents, expires_at, receive_units)
  values (p_tx, p_price_micro, p_fee_cents, p_receive_cents, p_expires_at, p_receive_units) returning * into q;
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
  if t.counter_asset is not null and q.receive_units is null then raise exception 'This quote has no swap amount. Request a new one.' using errcode = '22023'; end if;
  update quotes set accepted_at = now() where id = q.id;
  update transactions set counter_amount = q.receive_units where id = t.id and t.counter_asset is not null;
  return public.transition_tx(p_tx, 'accepted', 'Customer', null, jsonb_strip_nulls(jsonb_build_object(
    'quote_id', q.id::text, 'price_micro', q.price_micro::text, 'receive_cents', q.receive_cents::text, 'receive_units', q.receive_units::text)));
end $$;

-- ───────── Yield: one Flexible product per asset ─────────
alter table public.yield_positions add column asset text not null default 'XRP' references public.assets (id);

drop function public.yield_allocate(uuid, bigint, text, text);
create function public.yield_allocate(p_customer uuid, p_amount_drops bigint, p_terms_version text, p_idempotency_key text, p_asset text default 'XRP')
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
  if not exists (select 1 from consents where customer_id = p_customer and document = 'yield') then
    insert into consents (id, customer_id, document, version, surface) values (public.next_ref('CNS'), p_customer, 'yield', p_terms_version, 'Earn · ' || a.id || ' Flexible');
  end if;
  t := public.create_tx(p_customer, 'yield_allocate', public.next_ref('YLD'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('asset', a.id, 'meta', jsonb_build_object('product', a.id || ' Flexible')), p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, p_customer, jsonb_build_array(jsonb_build_array('Product terms accepted', 'Yield Product Terms draft ' || p_terms_version, 'ok'),
    jsonb_build_array('Above minimum', public.fmt_units(p_amount_drops, a.id) || ' ≥ ' || public.fmt_units(a.min_product, a.id), 'ok')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Allocated ' || public.fmt_units(p_amount_drops, a.id) || ' to ' || a.id || ' Flexible', t.ref);
  return t;
end $$;

drop function public.yield_redeem(uuid, bigint, text);
create function public.yield_redeem(p_customer uuid, p_amount_drops bigint, p_idempotency_key text, p_asset text default 'XRP')
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  t transactions;
  allocated bigint;
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  select coalesce(allocated_drops, 0) into allocated from yield_positions where customer_id = p_customer and product = lower(a.id) || '_flexible';
  if p_amount_drops <= 0 or p_amount_drops > coalesce(allocated, 0) then
    raise exception 'You have % allocated.', public.fmt_units(coalesce(allocated, 0), a.id) using errcode = '22023';
  end if;
  t := public.create_tx(p_customer, 'yield_redeem', public.next_ref('YLD'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('asset', a.id, 'meta', jsonb_build_object('product', a.id || ' Flexible')), p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by) values (t.id, 1, p_customer);
  return t;
end $$;

create or replace function public.sync_yield_position() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_product text := lower(new.asset) || '_flexible';
begin
  if new.kind = 'yield_allocate' and new.status = 'confirmed' and old.status <> 'confirmed' then
    insert into yield_positions (customer_id, product, asset, allocated_drops, apr_bps, fee_bps)
    values (new.customer_id, v_product, new.asset, new.amount_drops, coalesce((select yield_apr_bps from assets where id = new.asset), 0), 1000)
    on conflict (customer_id, product) do update set allocated_drops = yield_positions.allocated_drops + excluded.allocated_drops;
  elsif new.kind = 'yield_redeem' and new.status = 'confirmed' and old.status <> 'confirmed' then
    update yield_positions set allocated_drops = allocated_drops - new.amount_drops where customer_id = new.customer_id and product = lower(new.asset) || '_flexible';
  end if;
  return new;
end $$;

drop function public.record_yield_reward(text, bigint, text, text);
create function public.record_yield_reward(p_account_ref text, p_gross_drops bigint, p_period text, p_event text, p_asset text default 'XRP')
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  t transactions;
  fee bigint;
begin
  perform public.asset_spec(p_asset);
  select * into c from customers where account_ref = p_account_ref;
  if not found then raise exception 'Unknown account %', p_account_ref using errcode = 'P0002'; end if;
  select * into t from transactions where customer_id = c.id and kind = 'yield_reward' and idempotency_key = p_event;
  if found then return t; end if;
  fee := (p_gross_drops * 1000 + 5000) / 10000; -- 10% provider-share fee, half-up
  t := public.create_tx(c.id, 'yield_reward', public.next_ref('YLD'), 'statement_received', p_gross_drops, '[Yield provider]',
    jsonb_build_object('asset', p_asset, 'fee_drops', fee, 'meta', jsonb_build_object('period', p_period, 'product', p_asset || ' Flexible')), p_event);
  if exists (select 1 from yield_positions where customer_id = c.id and asset = p_asset and allocated_drops > 0) then
    t := public.transition_tx(t.id, 'matched', 'System');
    t := public.transition_tx(t.id, 'credited', 'System');
  else
    t := public.transition_tx(t.id, 'mismatch', 'System', 'No active position for this statement line');
  end if;
  return t;
end $$;

-- ───────── Loans: collateral in any accepted asset ─────────
alter table public.loans add column collateral_asset text not null default 'XRP' references public.assets (id);

drop function public.loan_apply(uuid, bigint, bigint, bigint, text, text);
create function public.loan_apply(
  p_customer uuid, p_collateral_drops bigint, p_principal_cents bigint, p_price_micro bigint, p_agreement_version text, p_idempotency_key text,
  p_asset text default 'XRP'
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  a assets;
  t transactions;
  ltv int;
  free bigint;
begin
  c := public.assert_customer_can_transact(p_customer);
  a := public.asset_spec(p_asset);
  if not a.collateral then raise exception '% can’t be used as collateral yet.', a.name using errcode = '22023'; end if;
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
                       'meta', jsonb_build_object('starting_ltv', to_char(ltv / 100.0, 'FM990.0') || '%', 'price_micro', p_price_micro::text)), p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, p_customer, jsonb_build_array(jsonb_build_array('Identity verified', 'Verified', 'ok'),
    jsonb_build_array('Collateral available', public.fmt_units(p_collateral_drops, a.id) || ' free', 'ok'),
    jsonb_build_array('Agreement accepted', 'Lending Agreement draft ' || p_agreement_version, 'ok'), jsonb_build_array('Provider credit decision', 'Pending', 'wait')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted loan application', t.ref);
  return t;
end $$;

create or replace function public.loan_add_collateral(p_customer uuid, p_loan uuid, p_amount_drops bigint, p_idempotency_key text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  l loans;
  a assets;
begin
  perform public.assert_customer_can_transact(p_customer);
  select * into l from loans where id = p_loan and customer_id = p_customer for update;
  if not found then raise exception 'Loan not found' using errcode = 'P0002'; end if;
  a := public.asset_spec(l.collateral_asset);
  if p_amount_drops < a.min_product then raise exception 'The minimum top-up is %.', public.fmt_units(a.min_product, a.id) using errcode = '22023'; end if;
  return public.create_tx(p_customer, 'loan_collateral', l.ref || ' · collateral C' || (select count(*) + 1 from transactions where loan_id = l.id and kind = 'loan_collateral'),
    'recorded', p_amount_drops, 'Customer', jsonb_build_object('asset', a.id, 'loan_id', l.id::text, 'meta', jsonb_build_object('loan_ref', l.ref)), p_idempotency_key);
end $$;

-- When the provider activates a loan, open its loan record (terms from the application).
create or replace function public.open_loan_record() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  l loans;
begin
  if new.kind = 'loan' and new.status = 'active' and old.status = 'funded' and new.loan_id is null then
    insert into loans (ref, customer_id, principal_usd_cents, apr_bps, collateral_drops, collateral_asset, origination_fee_cents, status, funded_at, next_interest_due)
    values (new.ref, new.customer_id, new.amount_cents, 1000, new.amount_drops, new.asset, (new.amount_cents * 100 + 5000) / 10000, 'active', now(), (now() + interval '1 month')::date)
    on conflict (ref) do nothing
    returning * into l;
    if l.id is not null then update transactions set loan_id = l.id where id = new.id; end if;
  end if;
  return new;
end $$;
create trigger transactions_open_loan after update of status on public.transactions for each row execute function public.open_loan_record();

-- LTV monitor: each loan priced in its own collateral asset.
create or replace function public.ltv_check() returns void
language plpgsql security definer set search_path = public as $$
declare
  l loans;
  price bigint;
  dec int;
  owed bigint;
  ltv int;
begin
  for l in select * from loans where status in ('active', 'margin_call') for update loop
    select usd_micro into price from prices where asset = l.collateral_asset order by at desc limit 1;
    if price is null then continue; end if;
    select decimals into dec from assets where id = l.collateral_asset;
    owed := l.principal_usd_cents + l.interest_usd_cents - l.repaid_usd_cents;
    ltv := round(owed::numeric * power(10::numeric, dec + 4) * 10000 / nullif(l.collateral_drops::numeric * price, 0));
    if ltv >= l.liquidation_bps and l.status <> 'liquidating' then
      update loans set status = 'liquidating' where id = l.id;
      perform audit('system', 'ltv-monitor', 'System', null, 'Flagged loan for liquidation by lending provider', l.ref);
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

-- ───────── Approvals: reported deposits and the generic two-approval rule ─────────
create or replace function public.approval_decide(
  p_approval uuid, p_decision text, p_reason text default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a approvals;
  t transactions;
  r text := public.app_role();
  me uuid := auth.uid();
  who text := coalesce(public.staff_name(), 'Staff');
  approvals_so_far int;
  prior_roles text[];
begin
  if r is null or r = 'auditor' then
    raise exception 'Read-only role: you can view but not act.' using errcode = '42501';
  end if;
  select * into a from approvals where id = p_approval for update;
  if not found then raise exception 'Approval not found' using errcode = 'P0002'; end if;
  if a.status <> 'pending' then raise exception 'This request has already been decided.' using errcode = '22023'; end if;
  select * into t from transactions where id = a.transaction_id for update;

  if not public.role_can_decide(r, t.kind) then
    raise exception 'Your role can’t approve % requests.', t.kind using errcode = '42501';
  end if;
  if a.requested_by = me then
    raise exception 'Separation of duties: you can’t decide a request you raised.' using errcode = '42501';
  end if;
  if exists (select 1 from approval_decisions where approval_id = a.id and staff_id = me) then
    raise exception 'Separation of duties: you have already decided this request.' using errcode = '42501';
  end if;

  if p_decision = 'reject' then
    if p_reason is null or coalesce(length(trim(p_note)), 0) < 10 then
      raise exception 'Choose a reason and write at least a short note — it goes into the audit log.' using errcode = '22023';
    end if;
    insert into approval_decisions (approval_id, staff_id, role, decision, reason, note) values (a.id, me, r::staff_role, 'reject', p_reason, p_note);
    update approvals set status = 'rejected' where id = a.id;
    if t.kind = 'deposit' then
      -- A reported deposit is closed; an unattributed one stays in suspense until attributed or returned.
      if t.status = 'reported' then
        perform public.transition_tx(t.id, 'rejected', who, p_reason || ' — ' || p_note, jsonb_build_object('reason', p_reason));
      end if;
    else
      perform public.transition_tx(t.id, 'rejected', who, p_reason || ' — ' || p_note, jsonb_build_object('reason', p_reason));
    end if;
    perform public.audit('staff', me::text, who, r, 'Rejected · ' || p_reason, t.ref, jsonb_build_object('note', p_note));
    return jsonb_build_object('status', 'rejected');
  end if;

  select count(*), array_agg(role::text) into approvals_so_far, prior_roles
  from approval_decisions where approval_id = a.id and decision = 'approve';
  if a.required = 2 and approvals_so_far = 1 and a.requires_compliance and r = prior_roles[1] then
    raise exception 'Separation of duties: the first approval came from your role. The second must come from a different role.' using errcode = '42501';
  end if;
  if a.required = 2 and approvals_so_far = 1 and a.requires_compliance and r <> 'compliance' and 'compliance' <> all(prior_roles) then
    raise exception 'Over % : one approval must come from Compliance.', public.fmt_units((select approval_threshold from assets where id = t.asset), t.asset) using errcode = '42501';
  end if;

  insert into approval_decisions (approval_id, staff_id, role, decision, note) values (a.id, me, r::staff_role, 'approve', p_note);
  approvals_so_far := approvals_so_far + 1;
  perform public.audit('staff', me::text, who, r, 'Approved ' || t.kind::text || ' · ' || approvals_so_far || ' of ' || a.required, t.ref);

  if approvals_so_far >= a.required then
    update approvals set status = 'approved' where id = a.id;
    case t.kind
      when 'withdrawal' then perform public.transition_tx(t.id, 'approved', who);
      when 'exchange' then perform public.transition_tx(t.id, 'quote_requested', who);
      when 'loan' then perform public.transition_tx(t.id, 'approved', who);
      when 'yield_allocate' then perform public.transition_tx(t.id, 'sent', who);
      when 'yield_redeem' then perform public.transition_tx(t.id, 'sent', who);
      when 'deposit' then
        if t.status = 'reported' then
          perform public.transition_tx(t.id, 'validated', who, 'Confirmed on the network by staff');
          perform public.transition_tx(t.id, 'screened', who);
          perform public.transition_tx(t.id, 'credited', who);
        else
          perform public.attribute_deposit(t.id, (t.meta->>'claimed_by')::uuid, who);
        end if;
      else null;
    end case;
    return jsonb_build_object('status', 'approved');
  end if;
  return jsonb_build_object('status', 'pending', 'approvals', approvals_so_far);
end $$;

-- ───────── Staff: set deposit addresses ─────────
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
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), r,
    'Set ' || a.id || ' deposit address' || case when addr is null then ' (closed)' else ' · ' || left(addr, 10) || '…' end, a.id);
  return a;
end $$;

revoke execute on function public.request_withdrawal, public.request_exchange, public.record_quote, public.yield_allocate, public.yield_redeem,
  public.loan_apply, public.record_yield_reward, public.report_deposit, public.asset_spec from anon, authenticated, public;
