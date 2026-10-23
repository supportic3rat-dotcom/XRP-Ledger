-- Writes from the XRPL worker (service role). Each is idempotent: replaying a ledger never double-credits.

create unique index if not exists transactions_deposit_hash on public.transactions (ledger_hash) where kind = 'deposit';

-- A validated, tesSUCCESS payment into the omnibus address. Maps the destination tag to a customer; a missing or
-- unknown tag goes to suspense. Unverified customers and screening hits wait in screening_hold for Compliance.
create or replace function public.chain_record_deposit(
  p_hash text, p_ledger_index bigint, p_tag bigint, p_amount_drops bigint, p_from text, p_screening_hold boolean
) returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  t transactions;
  c customers;
begin
  select * into t from transactions where kind = 'deposit' and ledger_hash = p_hash;
  if found then return t; end if;
  if p_tag is not null then select * into c from customers where destination_tag = p_tag; end if;

  t := public.create_tx(c.id, 'deposit', public.next_ref('DEP'), 'detected', p_amount_drops, 'XRPL worker',
    jsonb_build_object('counterparty', p_from, 'destination_tag', p_tag::text));
  update transactions set ledger_hash = p_hash, ledger_index = p_ledger_index where id = t.id returning * into t;

  if c.id is null then
    return public.transition_tx(t.id, 'no_tag', 'XRPL worker',
      case when p_tag is null then 'No destination tag' else 'Unknown destination tag ' || p_tag end);
  end if;
  t := public.transition_tx(t.id, 'validated', 'XRPL worker', 'Validated in ledger ' || p_ledger_index);
  if p_screening_hold or c.kyc_status <> 'verified' then
    insert into approvals (transaction_id, required, requires_compliance, checks) values (t.id, 1, true, jsonb_build_array(
      jsonb_build_array(case when p_screening_hold then 'Source flagged by screening' else 'Customer not verified' end,
        '[Screening provider]', 'bad')));
    return public.transition_tx(t.id, 'screening_hold', 'XRPL worker');
  end if;
  t := public.transition_tx(t.id, 'screened', '[Screening provider]');
  return public.transition_tx(t.id, 'credited', 'System');
end $$;

create or replace function public.chain_withdrawal_submitted(p_tx uuid, p_transfer_id text, p_last_ledger bigint, p_tx_hash text default null)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  t transactions;
begin
  select * into t from transactions where id = p_tx and kind = 'withdrawal';
  if t.status = 'submitted' then return t; end if;
  return public.transition_tx(p_tx, 'submitted', '[Custody provider]', 'Signed and submitted',
    jsonb_strip_nulls(jsonb_build_object('transfer_id', p_transfer_id, 'last_ledger_sequence', p_last_ledger::text, 'tx_hash', p_tx_hash)));
end $$;

-- The custody provider reports the ledger hash after submission.
create or replace function public.chain_withdrawal_hash(p_tx uuid, p_tx_hash text) returns void
language sql security definer set search_path = public as $$
  update transactions set meta = meta || jsonb_build_object('tx_hash', p_tx_hash) where id = p_tx and kind = 'withdrawal' and status = 'submitted';
$$;

-- Only called after the worker itself saw tesSUCCESS in a validated ledger.
create or replace function public.chain_withdrawal_validated(p_tx uuid, p_hash text, p_ledger_index bigint, p_fee_drops bigint)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  t transactions;
begin
  select * into t from transactions where id = p_tx and kind = 'withdrawal' for update;
  if t.status = 'validated' then return t; end if;
  update transactions set ledger_hash = p_hash, ledger_index = p_ledger_index where id = p_tx;
  return public.transition_tx(p_tx, 'validated', 'XRPL worker', 'tesSUCCESS in validated ledger ' || p_ledger_index,
    jsonb_build_object('actual_fee_drops', p_fee_drops::text));
end $$;

create or replace function public.chain_withdrawal_failed(p_tx uuid, p_reason text, p_hash text default null) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  t transactions;
begin
  select * into t from transactions where id = p_tx and kind = 'withdrawal' for update;
  if t.status = 'failed' then return t; end if;
  if p_hash is not null then update transactions set ledger_hash = p_hash where id = p_tx; end if;
  return public.transition_tx(p_tx, 'failed', 'XRPL worker', p_reason);
end $$;

revoke execute on function public.chain_record_deposit, public.chain_withdrawal_submitted, public.chain_withdrawal_hash, public.chain_withdrawal_validated,
  public.chain_withdrawal_failed from anon, authenticated, public;
