-- Row-level security on every table. Customers read only their own rows and never write money tables.
-- Staff read through their role; personal data reaches Operations and Auditors only via customers_masked.
-- Writes happen in security-definer functions called by Edge Functions (service role) or staff RPCs.

do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'staff_roles', 'auth_backup_codes', 'devices', 'security_events', 'kyc_checks', 'ledger_accounts',
    'journal_entries', 'journal_lines', 'transactions', 'transaction_events', 'tx_transitions', 'approvals',
    'approval_decisions', 'loans', 'yield_positions', 'quotes', 'allowlist_addresses', 'external_wallets',
    'legal_documents', 'consents', 'notifications', 'support_tickets', 'ticket_messages', 'prices', 'idempotency_keys',
    'provider_events', 'chain_cursor', 'worker_heartbeat', 'custody_wallets', 'signers', 'policy_changes', 'limits',
    'recon_runs', 'recon_exceptions', 'customer_flags', 'audit_events', 'audit_verifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ───────── Customer-owned reads ─────────
create policy customers_self on public.customers for select to authenticated using (id = auth.uid());
create policy customers_compliance on public.customers for select to authenticated using (public.app_role() = 'compliance');

create policy own_devices on public.devices for select to authenticated using (customer_id = auth.uid());
create policy own_security_events on public.security_events for select to authenticated using (customer_id = auth.uid());
create policy own_kyc on public.kyc_checks for select to authenticated using (customer_id = auth.uid() or public.app_role() = 'compliance');
create policy own_allowlist on public.allowlist_addresses for select to authenticated using (customer_id = auth.uid());
create policy own_external on public.external_wallets for select to authenticated using (customer_id = auth.uid());
create policy own_consents on public.consents for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy own_notifications on public.notifications for select to authenticated using (customer_id = auth.uid());
create policy own_tickets on public.support_tickets for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy own_ticket_messages on public.ticket_messages for select to authenticated using (
  exists (select 1 from public.support_tickets s where s.ref = ticket_ref and (s.customer_id = auth.uid() or public.is_staff()))
);

-- ───────── Money tables: own rows for customers, everything for staff, no writes for anyone ─────────
create policy tx_read on public.transactions for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy tx_events_read on public.transaction_events for select to authenticated using (
  exists (select 1 from public.transactions t where t.id = transaction_id and (t.customer_id = auth.uid() or public.is_staff()))
);
create policy accounts_read on public.ledger_accounts for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy entries_read on public.journal_entries for select to authenticated using (
  public.is_staff() or exists (select 1 from public.transactions t where t.id = transaction_id and t.customer_id = auth.uid())
);
create policy lines_read on public.journal_lines for select to authenticated using (
  public.is_staff() or exists (select 1 from public.ledger_accounts a where a.id = account_id and a.customer_id = auth.uid())
);
create policy loans_read on public.loans for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy yield_read on public.yield_positions for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy quotes_read on public.quotes for select to authenticated using (
  exists (select 1 from public.transactions t where t.id = transaction_id and (t.customer_id = auth.uid() or public.is_staff()))
);
create policy approvals_read on public.approvals for select to authenticated using (public.is_staff());
create policy decisions_read on public.approval_decisions for select to authenticated using (public.is_staff());

-- ───────── Reference data ─────────
create policy transitions_read on public.tx_transitions for select to authenticated using (true);
create policy legal_read on public.legal_documents for select to anon, authenticated using (true);
create policy prices_read on public.prices for select to anon, authenticated using (true);

-- ───────── Staff-only operational tables ─────────
create policy staff_roles_self on public.staff_roles for select to authenticated using (staff_id = auth.uid() or public.is_staff());
create policy heartbeat_staff on public.worker_heartbeat for select to authenticated using (public.is_staff());
create policy wallets_staff on public.custody_wallets for select to authenticated using (public.is_staff());
create policy signers_staff on public.signers for select to authenticated using (public.is_staff());
create policy policy_staff on public.policy_changes for select to authenticated using (public.is_staff());
create policy limits_staff on public.limits for select to authenticated using (public.is_staff());
create policy recon_runs_staff on public.recon_runs for select to authenticated using (public.is_staff());
create policy recon_exc_staff on public.recon_exceptions for select to authenticated using (public.is_staff());
create policy flags_staff on public.customer_flags for select to authenticated using (public.is_staff());
create policy audit_staff on public.audit_events for select to authenticated using (public.is_staff());
create policy audit_verif_staff on public.audit_verifications for select to authenticated using (public.is_staff());
-- auth_backup_codes, idempotency_keys, provider_events, chain_cursor: no policies → service role only.

-- ───────── Balances view for the signed-in customer ─────────
grant select on public.balances to authenticated;
revoke all on public.balances_snapshot from anon, authenticated;
create or replace function public.staff_balances_snapshot() returns setof public.balances_snapshot
language sql stable security definer set search_path = public as $$
  select * from balances_snapshot where public.is_staff()
$$;

-- ───────── Personal data masked by role (Compliance full, Operations partial, Auditor masked) ─────────
create or replace function public.mask_name(n text, r text) returns text language sql immutable as $$
  select case r
    when 'compliance' then n
    when 'operations' then split_part(n, ' ', 1) || ' ' || left(split_part(n, ' ', 2), 1) || '.'
    else (select string_agg(left(w, 1) || '••••', ' ') from unnest(string_to_array(n, ' ')) as w) end
$$;

create or replace view public.customers_masked as
select
  c.id,
  c.account_ref,
  public.mask_name(c.full_name, public.app_role()) as full_name,
  case public.app_role()
    when 'compliance' then c.email
    when 'operations' then left(c.email, 2) || '•••@' || split_part(c.email, '@', 2)
    else '•••@' || split_part(c.email, '@', 2) end as email,
  case public.app_role()
    when 'compliance' then c.phone
    when 'operations' then split_part(c.phone, ' ', 1) || ' ••• ••• ' || right(replace(c.phone, ' ', ''), 4)
    else '•••• ' || right(replace(c.phone, ' ', ''), 4) end as phone,
  case public.app_role()
    when 'compliance' then to_char(c.dob, 'YYYY-MM-DD')
    when 'operations' then '••••-••-•• (' || to_char(c.dob, 'YYYY') || ')'
    else 'Hidden' end as dob,
  c.country, c.kyc_status, c.kyc_level, c.risk_rating, c.frozen_at, c.created_at
from public.customers c
where public.is_staff();
grant select on public.customers_masked to authenticated;

-- Compliance opening a full record is itself audited.
create or replace function public.open_customer_record(p_customer uuid) returns public.customers
language plpgsql security definer set search_path = public as $$
declare
  c customers;
begin
  if public.app_role() <> 'compliance' then
    raise exception 'Only Compliance can open the full record.' using errcode = '42501';
  end if;
  select * into c from customers where id = p_customer;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), 'compliance', 'Opened full customer record', c.account_ref);
  return c;
end $$;

-- ───────── Small customer self-service RPCs (no money) ─────────
create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now()
  where customer_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
$$;

create or replace function public.set_display_currency(p_currency text) returns void
language sql security definer set search_path = public as $$
  update customers set display_currency = p_currency where id = auth.uid() and p_currency in ('USD', 'NGN', 'GBP', 'EUR');
$$;

grant execute on function public.mark_notifications_read, public.set_display_currency, public.approval_decide,
  public.policy_decide, public.customer_freeze, public.customer_flag, public.open_customer_record,
  public.staff_balances_snapshot to authenticated;
revoke execute on function public.transition_tx, public.create_tx, public.post_entry, public.attribute_deposit,
  public.audit, public.ledger_account from anon, authenticated, public;

-- ───────── Realtime: statuses update live in the app and the console ─────────
alter publication supabase_realtime add table public.transactions, public.transaction_events, public.notifications,
  public.approvals, public.recon_exceptions;
