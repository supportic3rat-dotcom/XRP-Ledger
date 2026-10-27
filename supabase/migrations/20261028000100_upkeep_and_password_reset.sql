-- Scheduled upkeep on Supabase (owner's decision, 2026-10-28): no always-on server and no pg_cron. The app calls the
-- `upkeep` Edge Function while it's open; each job runs only when it's due, and upkeep_claim makes sure two callers
-- never run the same job twice.

create table public.job_runs (
  job text primary key,
  last_run_at timestamptz not null
);
alter table public.job_runs enable row level security;
create policy staff_read on public.job_runs for select to authenticated using (public.is_staff());

-- Claims a job if it's due: interval jobs every `p_every`; daily jobs (p_daily_at = minutes past midnight UTC) once
-- per UTC day, at or after that time. True means the caller runs it now.
create or replace function public.upkeep_claim(p_job text, p_every interval, p_daily_at int default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  claimed boolean;
  utc timestamp := now() at time zone 'utc';
begin
  if p_daily_at is not null and extract(hour from utc) * 60 + extract(minute from utc) < p_daily_at then return false; end if;
  insert into job_runs (job, last_run_at) values (p_job, now())
  on conflict (job) do update set last_run_at = now()
  where case when p_daily_at is not null
             then (job_runs.last_run_at at time zone 'utc')::date < utc::date
             else job_runs.last_run_at <= now() - p_every end
  returning true into claimed;
  return coalesce(claimed, false);
end $$;

revoke execute on function public.upkeep_claim(text, interval, int) from public, anon, authenticated;
grant execute on function public.upkeep_claim(text, interval, int) to service_role;

-- Password reset by support (owner's decision, 2026-10-28): the customer emails support, and Compliance sets a new
-- password in the console and emails it back. Every session is signed out, withdrawals pause for 24 hours, and the
-- customer is told to choose their own password. The Edge Function sets the password itself.
create or replace function public.customer_password_reset(p_customer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  c customers;
begin
  if r is distinct from 'compliance' then raise exception 'Only Compliance can reset a customer’s password.' using errcode = '42501'; end if;
  select * into c from customers where id = p_customer for update;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;
  perform public.password_changed(p_customer, null);
  insert into notifications (customer_id, type, tone, icon, title, body, link) values (
    p_customer, 'security', 'warn', 'lock', 'Your password was reset by support',
    'Choose your own password now in Security. Withdrawals are paused for 24 hours.', '/security');
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), r, 'Reset customer password · sessions signed out', c.account_ref);
end $$;

revoke execute on function public.customer_password_reset from public, anon;
grant execute on function public.customer_password_reset(uuid) to authenticated;

-- Exchanges are coin-to-coin only: there is no bank payout, so a USD sale would leave money customers can't withdraw.
create or replace function public.request_exchange(
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
  if p_to_asset is null then raise exception 'Choose the coin you want to receive.' using errcode = '22023'; end if;
  b := public.asset_spec(p_to_asset);
  if b.id = a.id then raise exception 'Choose a different asset to receive.' using errcode = '22023'; end if;
  if p_amount_drops < a.min_product then raise exception 'The minimum request is %.', public.fmt_units(a.min_product, a.id) using errcode = '22023'; end if;
  if public.account_balance(public.ledger_account(p_customer, 'available', a.id)) < p_amount_drops then
    raise exception 'That’s more than your available balance.' using errcode = '22023';
  end if;
  t := public.create_tx(p_customer, 'exchange', public.next_ref('EX'), 'requested', p_amount_drops, 'Customer',
    jsonb_build_object('asset', a.id, 'counter_asset', b.id,
                       'meta', jsonb_build_object('indicative_cents', p_indicative_cents::text, 'receive', b.id)),
    p_idempotency_key);
  insert into approvals (transaction_id, required, requested_by, checks)
  values (t.id, 1, p_customer, jsonb_build_array(
    jsonb_build_array('Customer eligible', 'Verified, within exchange limits', 'ok'),
    jsonb_build_array('Swap ' || a.id || ' → ' || b.id, public.fmt_units(p_amount_drops, a.id), 'ok'),
    jsonb_build_array('Liquidity provider quote', 'Not requested yet', 'wait')));
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Submitted exchange request', t.ref);
  return t;
end $$;
