-- Inputs for the three-way reconciliation (internal ledger vs custody provider vs XRP Ledger).

-- On-ledger balances of our custody wallets, written by the XRPL worker from validated ledgers.
create table if not exists public.chain_balances (
  address text primary key,
  balance_drops bigint not null check (balance_drops >= 0),
  ledger_index bigint not null,
  at timestamptz not null default now()
);
alter table public.chain_balances enable row level security;
create policy staff_read on public.chain_balances for select to authenticated using (public.is_staff());

-- Everything recon-run needs from the books, read in one consistent snapshot.
create or replace function public.recon_inputs() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'omnibus_drops', public.account_balance(public.ledger_account(null, 'omnibus'))::text,
    'customer_liabilities_drops', coalesce((
      select sum(public.account_balance(a.id)) from ledger_accounts a where a.customer_id is not null and a.asset = 'XRP'), 0)::text,
    'suspense_drops', public.account_balance(public.ledger_account(null, 'suspense'))::text,
    'validated_ledger', coalesce((select max(validated_ledger) from worker_heartbeat), 0),
    'chain', coalesce((select jsonb_object_agg(address, balance_drops::text) from chain_balances), '{}'::jsonb),
    'wallets', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'tier', tier, 'address', address) order by tier) from custody_wallets), '[]'::jsonb),
    'suspense_deposits', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'ref', ref, 'amount_drops', amount_drops::text))
      from transactions where kind = 'deposit' and status = 'no_tag' and customer_id is null), '[]'::jsonb),
    'delayed', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'ref', ref, 'kind', kind, 'amount_drops', amount_drops::text,
        'minutes', floor(extract(epoch from now() - updated_at) / 60)::int))
      from transactions where status = 'sent' and kind in ('yield_allocate', 'yield_redeem', 'loan_collateral')
        and updated_at < now() - interval '30 minutes'), '[]'::jsonb),
    -- Actual network fees (recorded by the worker from validated results) above what was booked.
    'unbooked_fees', coalesce((
      select jsonb_build_object('count', count(*), 'drops', sum((meta ->> 'actual_fee_drops')::bigint - network_fee_drops)::text)
      from transactions
      where kind = 'withdrawal' and status = 'validated' and meta ? 'actual_fee_drops'
        and (meta ->> 'actual_fee_drops')::bigint > network_fee_drops and not coalesce((meta ->> 'fee_adjusted')::boolean, false)
      having count(*) > 0), 'null'::jsonb)
  )
$$;
revoke execute on function public.recon_inputs from anon, authenticated, public;

-- ───────── Yield rewards from the provider's statement ─────────
-- A statement line becomes a yield_reward transaction. It is credited (net of the 10% fee) only when it
-- matches a customer with an active position; otherwise it stays in `mismatch` for reconciliation.
create or replace function public.record_yield_reward(p_account_ref text, p_gross_drops bigint, p_period text, p_event text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  c customers;
  t transactions;
  fee bigint;
begin
  select * into c from customers where account_ref = p_account_ref;
  if not found then raise exception 'Unknown account %', p_account_ref using errcode = 'P0002'; end if;
  select * into t from transactions where customer_id = c.id and kind = 'yield_reward' and idempotency_key = p_event;
  if found then return t; end if;
  fee := (p_gross_drops * 1000 + 5000) / 10000; -- 10% provider-share fee, half-up
  t := public.create_tx(c.id, 'yield_reward', public.next_ref('YLD'), 'statement_received', p_gross_drops, '[Yield provider]',
    jsonb_build_object('fee_drops', fee, 'meta', jsonb_build_object('period', p_period)), p_event);
  if exists (select 1 from yield_positions where customer_id = c.id and allocated_drops > 0) then
    t := public.transition_tx(t.id, 'matched', 'System');
    t := public.transition_tx(t.id, 'credited', 'System');
  else
    t := public.transition_tx(t.id, 'mismatch', 'System', 'No active position for this statement line');
  end if;
  return t;
end $$;
revoke execute on function public.record_yield_reward from anon, authenticated, public;
