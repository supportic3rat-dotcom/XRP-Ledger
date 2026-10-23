-- Ledger invariants, enforced in Postgres so a client or function bug can't create or lose XRP.

-- 1. Every journal entry must balance to zero. Deferred so all lines of an entry can be inserted first.
create or replace function public.check_entry_balanced() returns trigger
language plpgsql as $$
declare
  total bigint;
  n int;
begin
  select coalesce(sum(amount_drops), 0), count(*) into total, n
  from public.journal_lines where entry_id = new.entry_id;
  if n < 2 then
    raise exception 'Journal entry % has fewer than two lines', new.entry_id using errcode = '23514';
  end if;
  if total <> 0 then
    raise exception 'Journal entry % is not balanced (sum %)', new.entry_id, total using errcode = '23514';
  end if;
  return null;
end $$;

create constraint trigger journal_lines_balanced
after insert on public.journal_lines
deferrable initially deferred
for each row execute function public.check_entry_balanced();

-- 2. Posted entries, lines, events and audit rows are immutable. Corrections are compensating entries.
create or replace function public.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% rows are append-only; post a compensating entry instead', tg_table_name using errcode = '42501';
end $$;

create trigger journal_entries_immutable before update or delete on public.journal_entries
for each row execute function public.forbid_mutation();
create trigger journal_lines_immutable before update or delete on public.journal_lines
for each row execute function public.forbid_mutation();
create trigger transaction_events_immutable before update or delete on public.transaction_events
for each row execute function public.forbid_mutation();
create trigger approval_decisions_immutable before update or delete on public.approval_decisions
for each row execute function public.forbid_mutation();
create trigger audit_events_immutable before update or delete on public.audit_events
for each row execute function public.forbid_mutation();
create trigger consents_immutable before update or delete on public.consents
for each row execute function public.forbid_mutation();

-- 3. Balances are sums of lines, never stored numbers.
create or replace view public.balances with (security_invoker = true) as
select
  a.id as account_id,
  a.customer_id,
  a.kind,
  a.asset,
  case when a.normal_side = 'debit' then coalesce(sum(l.amount_drops), 0) else -coalesce(sum(l.amount_drops), 0) end as balance_drops
from public.ledger_accounts a
left join public.journal_lines l on l.account_id = a.id
group by a.id;

create materialized view public.balances_snapshot as
select account_id, customer_id, kind, asset, balance_drops, now() as refreshed_at from public.balances;
create unique index on public.balances_snapshot (account_id);

create or replace function public.ledger_account(p_customer uuid, p_kind public.account_kind, p_asset text default 'XRP')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  acc uuid;
begin
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

create or replace function public.account_balance(p_account uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select balance_drops from balances where account_id = p_account
$$;

-- Posts a balanced entry. p_lines: [{"customer": uuid|null, "kind": "available", "amount": "-123"}]
-- Customer accounts touched are locked (select … for update) and may not go negative.
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
    acc := public.ledger_account(nullif(line->>'customer', '')::uuid, (line->>'kind')::account_kind);
    -- Lock in a stable order to avoid deadlocks between concurrent postings.
    perform 1 from ledger_accounts where id = acc for update;
    insert into journal_lines (entry_id, account_id, amount_drops) values (entry, acc, (line->>'amount')::bigint);
    touched := touched || acc;
  end loop;

  for acc in select distinct unnest(touched) loop
    if exists (select 1 from ledger_accounts where id = acc and customer_id is not null) then
      bal := public.account_balance(acc);
      if bal < 0 then
        raise exception 'Insufficient balance on account % (would be % drops)', acc, bal using errcode = '23514';
      end if;
    end if;
  end loop;
  return entry;
end $$;

-- Journal lines for each transition. Mirrors packages/ledger/src/journal.ts.
create or replace function public.journal_lines_for(p_tx public.transactions, p_to text) returns jsonb
language plpgsql stable as $$
declare
  c text := p_tx.customer_id::text;
  amt bigint := p_tx.amount_drops;
  fee bigint := p_tx.fee_drops + p_tx.network_fee_drops;
  via_suspense boolean := coalesce((p_tx.meta->>'via_suspense')::boolean, false);
begin
  case p_tx.kind::text || ':' || p_to
    when 'deposit:credited' then
      if via_suspense then
        return jsonb_build_array(jsonb_build_object('customer', null, 'kind', 'suspense', 'amount', amt::text),
                                 jsonb_build_object('customer', c, 'kind', 'available', 'amount', (-amt)::text));
      end if;
      return jsonb_build_array(jsonb_build_object('customer', null, 'kind', 'omnibus', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'available', 'amount', (-amt)::text));
    when 'deposit:no_tag' then
      return jsonb_build_array(jsonb_build_object('customer', null, 'kind', 'omnibus', 'amount', amt::text),
                               jsonb_build_object('customer', null, 'kind', 'suspense', 'amount', (-amt)::text));
    when 'withdrawal:requested' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'available', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'reserved', 'amount', (-amt)::text));
    when 'withdrawal:validated' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'reserved', 'amount', amt::text),
                               jsonb_build_object('customer', null, 'kind', 'omnibus', 'amount', (-(amt - p_tx.fee_drops))::text),
                               jsonb_build_object('customer', null, 'kind', 'fee_revenue', 'amount', (-p_tx.fee_drops)::text));
    when 'withdrawal:rejected', 'withdrawal:failed', 'withdrawal:cancelled' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'reserved', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'available', 'amount', (-amt)::text));
    when 'exchange:accepted' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'available', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'reserved', 'amount', (-amt)::text));
    when 'exchange:sold' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'reserved', 'amount', amt::text),
                               jsonb_build_object('customer', null, 'kind', 'omnibus', 'amount', (-amt)::text));
    when 'yield_allocate:requested' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'available', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'pending_yield', 'amount', (-amt)::text));
    when 'yield_allocate:confirmed' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'pending_yield', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'yield', 'amount', (-amt)::text));
    when 'yield_allocate:provider_failed' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'pending_yield', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'available', 'amount', (-amt)::text));
    when 'yield_redeem:confirmed' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'yield', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'available', 'amount', (-amt)::text));
    when 'yield_reward:credited' then
      return jsonb_build_array(jsonb_build_object('customer', null, 'kind', 'provider_receivable', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'available', 'amount', (-(amt - p_tx.fee_drops))::text),
                               jsonb_build_object('customer', null, 'kind', 'fee_revenue', 'amount', (-p_tx.fee_drops)::text));
    when 'loan:collateral_locked' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'available', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'collateral', 'amount', (-amt)::text));
    when 'loan_collateral:recorded' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'available', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'reserved', 'amount', (-amt)::text));
    when 'loan_collateral:lock_confirmed' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'reserved', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'collateral', 'amount', (-amt)::text));
    when 'loan_collateral:failed' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'reserved', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'available', 'amount', (-amt)::text));
    when 'loan:repaid' then
      return jsonb_build_array(jsonb_build_object('customer', c, 'kind', 'collateral', 'amount', amt::text),
                               jsonb_build_object('customer', c, 'kind', 'available', 'amount', (-amt)::text));
    else
      return '[]'::jsonb;
  end case;
end $$;

-- The only way a transaction changes state: checks the state machine, writes the event,
-- posts the journal entry for that step and notifies the customer — all in one database transaction.
create or replace function public.transition_tx(
  p_tx uuid, p_to text, p_actor text, p_note text default null, p_meta jsonb default '{}'::jsonb
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  t transactions;
  lines jsonb;
  reversal_of uuid;
begin
  select * into t from transactions where id = p_tx for update;
  if not found then
    raise exception 'Transaction % not found', p_tx using errcode = 'P0002';
  end if;
  if not exists (select 1 from tx_transitions where kind = t.kind and from_status = t.status and to_status = p_to) then
    raise exception 'Transition % → % is not allowed for %', t.status, p_to, t.kind using errcode = '22023';
  end if;

  t.meta := t.meta || p_meta;
  lines := public.journal_lines_for(t, p_to);
  if jsonb_array_length(lines) > 0 then
    if p_to in ('rejected', 'failed', 'cancelled', 'provider_failed') then
      select id into reversal_of from journal_entries where transaction_id = t.id order by created_at limit 1;
    end if;
    perform public.post_entry(t.kind::text || ':' || p_to, t.ref, t.id, p_actor, lines, p_note, reversal_of);
  end if;

  insert into transaction_events (transaction_id, from_status, to_status, actor, note) values (t.id, t.status, p_to, p_actor, p_note);
  update transactions set status = p_to, meta = t.meta, updated_at = now() where id = t.id returning * into t;

  if t.customer_id is not null then
    perform public.notify_transition(t);
  end if;
  return t;
end $$;

-- Creates a transaction in its initial state and posts the initial journal entry if any.
create or replace function public.create_tx(
  p_customer uuid, p_kind public.tx_kind, p_ref text, p_initial text, p_amount_drops bigint, p_actor text,
  p_fields jsonb default '{}'::jsonb, p_idempotency_key text default null
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  t transactions;
  lines jsonb;
begin
  insert into transactions (ref, customer_id, kind, status, amount_drops, amount_cents, fee_drops, network_fee_drops,
                            counterparty, destination_tag, loan_id, idempotency_key, meta)
  values (p_ref, p_customer, p_kind, p_initial, p_amount_drops, nullif(p_fields->>'amount_cents', '')::bigint,
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

-- Transition table (mirrors stateMachines.ts).
insert into public.tx_transitions (kind, from_status, to_status) values
  ('deposit','detected','validated'), ('deposit','detected','no_tag'), ('deposit','validated','screened'),
  ('deposit','validated','screening_hold'), ('deposit','screened','credited'), ('deposit','screening_hold','screened'),
  ('deposit','no_tag','validated'),
  ('withdrawal','requested','in_review'), ('withdrawal','requested','cancelled'), ('withdrawal','requested','rejected'),
  ('withdrawal','in_review','approved'), ('withdrawal','in_review','rejected'), ('withdrawal','in_review','cancelled'),
  ('withdrawal','approved','submitted'), ('withdrawal','approved','failed'), ('withdrawal','submitted','validated'),
  ('withdrawal','submitted','failed'),
  ('exchange','requested','quote_requested'), ('exchange','requested','rejected'), ('exchange','requested','cancelled'),
  ('exchange','quote_requested','quoted'), ('exchange','quote_requested','rejected'), ('exchange','quote_requested','cancelled'),
  ('exchange','quoted','accepted'), ('exchange','quoted','quote_expired'), ('exchange','quoted','cancelled'),
  ('exchange','quote_expired','quote_requested'), ('exchange','quote_expired','cancelled'),
  ('exchange','accepted','sold'), ('exchange','sold','paid_out'),
  ('yield_allocate','requested','sent'), ('yield_allocate','requested','provider_failed'),
  ('yield_allocate','sent','confirmed'), ('yield_allocate','sent','provider_failed'),
  ('yield_redeem','requested','sent'), ('yield_redeem','requested','provider_failed'),
  ('yield_redeem','sent','confirmed'), ('yield_redeem','sent','provider_failed'),
  ('yield_reward','statement_received','matched'), ('yield_reward','statement_received','mismatch'),
  ('yield_reward','matched','credited'), ('yield_reward','mismatch','matched'),
  ('loan','applied','approved'), ('loan','applied','rejected'), ('loan','approved','collateral_locked'),
  ('loan','approved','rejected'), ('loan','collateral_locked','funded'), ('loan','funded','active'),
  ('loan','active','repaid'), ('loan','active','margin_call'), ('loan','margin_call','active'),
  ('loan','margin_call','liquidating'), ('loan','margin_call','repaid'), ('loan','liquidating','repaid'),
  ('loan_repay','recorded','awaiting_payment'), ('loan_repay','recorded','selling'), ('loan_repay','recorded','failed'),
  ('loan_repay','awaiting_payment','received'), ('loan_repay','awaiting_payment','failed'),
  ('loan_repay','selling','received'), ('loan_repay','selling','failed'), ('loan_repay','received','applied'),
  ('loan_collateral','recorded','sent'), ('loan_collateral','recorded','failed'),
  ('loan_collateral','sent','lock_confirmed'), ('loan_collateral','sent','failed'),
  ('loan_collateral','lock_confirmed','ltv_updated');

-- Customer notifications for meaningful transitions. Never includes full addresses or codes.
create or replace function public.notify_transition(t public.transactions) returns void
language plpgsql security definer set search_path = public as $$
declare
  xrp text := to_char(t.amount_drops / 1000000.0, 'FM999,999,999,990.00');
begin
  case t.kind::text || ':' || t.status
    when 'deposit:detected' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'warn', 'recv', 'Deposit detected', xrp || ' XRP is waiting for ledger validation. It’s not in your balance yet.', '/');
    when 'deposit:credited' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'ok', 'recv', 'Deposit credited', xrp || ' XRP is now in your available balance.', '/');
    when 'withdrawal:validated' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'ok', 'recv', 'Withdrawal completed', xrp || ' XRP was validated on the XRP Ledger.', '/');
    when 'withdrawal:rejected' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'bad', 'alert', 'Withdrawal rejected', t.ref || ' was rejected. The reserved XRP is back in your available balance.', '/');
    when 'exchange:quoted' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'warn', 'ex', 'Firm quote ready', 'Accept the quote for ' || t.ref || ' before it expires.', '/exchange');
    when 'exchange:rejected' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'bad', 'ex', 'Exchange request rejected', t.ref || ' was rejected: ' || coalesce(t.meta->>'reason', 'see details') || '. No XRP was reserved.', '/');
    when 'yield_reward:credited' then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (t.customer_id, 'tx', 'ok', 'coin', 'Yield reward credited',
              to_char((t.amount_drops - t.fee_drops) / 1000000.0, 'FM999,999,990.00') || ' XRP from XRP Flexible is now in your available balance.', '/earn');
    else
      null;
  end case;
end $$;
