-- Two-factor is optional. A customer who has turned it on needs an aal2 session; everyone else is unaffected.
-- Edge Functions check this in _shared/handler.ts. This covers what the app reads directly through RLS.
create or replace function public.mfa_satisfied() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' or not public.has_totp(auth.uid())
$$;

revoke execute on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

-- Restrictive, so it applies on top of each table's own policies. A table added later needs its own copy.
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and rowsecurity loop
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t
    );
  end loop;
end $$;

-- A customer who lost their authenticator and backup codes emails support. Compliance removes two-factor here:
-- every session is signed out, withdrawals pause for 24 hours, the customer is told, and it's audited.
create or replace function public.customer_mfa_reset(p_customer uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  r text := public.app_role();
  c customers;
begin
  if r is distinct from 'compliance' then raise exception 'Only Compliance can remove two-factor.' using errcode = '42501'; end if;
  select * into c from customers where id = p_customer for update;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;
  if not public.has_totp(p_customer) then raise exception 'This customer doesn’t have two-factor on.' using errcode = '22023'; end if;
  delete from auth.mfa_factors where user_id = p_customer;
  update customers set mfa_disable_at = null where id = p_customer;
  update auth_backup_codes set used_at = now() where user_id = p_customer and used_at is null;
  perform public.revoke_sessions(p_customer);
  perform public.start_withdrawal_hold(p_customer, 'Two-factor removed by support');
  insert into notifications (customer_id, type, tone, icon, title, body, link) values (
    p_customer, 'security', 'warn', 'lock', 'Two-factor was removed by support',
    'You can turn it back on in Security. Withdrawals are paused for 24 hours.', '/security');
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), r, 'Removed customer two-factor · sessions signed out', c.account_ref);
end $$;

revoke execute on function public.customer_mfa_reset from public, anon;
grant execute on function public.customer_mfa_reset(uuid) to authenticated;
