-- Sessions, backup-code sign-in, the 2FA turn-off hold, and reconciliation writes.

-- Staff roles count only on a TOTP-verified session (aal2). RLS, approval_decide and every staff RPC use this.
create or replace function public.app_role() returns text
language sql stable as $$
  select case
    when auth.jwt() ->> 'app_role' in ('operations', 'compliance', 'auditor') and auth.jwt() ->> 'aal' is distinct from 'aal2' then null
    else nullif(auth.jwt() ->> 'app_role', '') end
$$;

create or replace function public.is_staff() returns boolean
language sql stable as $$ select coalesce(public.app_role() in ('operations', 'compliance', 'auditor'), false) $$;

-- ───────── Backup-code sign-in ─────────
-- A consumed backup code marks its session; the access-token hook then issues aal2 for that session only.
create table public.mfa_backup_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
alter table public.mfa_backup_sessions enable row level security;
grant select on public.mfa_backup_sessions to supabase_auth_admin;

create or replace function public.consume_backup_code(p_user uuid, p_code text, p_session uuid default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  hit uuid;
begin
  select id into hit from auth_backup_codes
  where user_id = p_user and used_at is null and code_hash = crypt(upper(p_code), code_hash)
  for update skip locked limit 1;
  if hit is null then return false; end if;
  update auth_backup_codes set used_at = now() where id = hit;
  if p_session is not null then
    insert into mfa_backup_sessions (session_id, user_id) values (p_session, p_user) on conflict (session_id) do nothing;
  end if;
  perform public.security_event(p_user, 'Signed in with a backup code');
  return true;
end $$;
revoke execute on function public.consume_backup_code(uuid, text, uuid) from anon, authenticated, public;
drop function if exists public.consume_backup_code(uuid, text);

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := event -> 'claims';
  r text;
begin
  select role::text into r from staff_roles where staff_id = (event ->> 'user_id')::uuid;
  if r is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(r));
  else
    claims := claims - 'app_role';
  end if;
  -- Customers only: a session that passed a backup code counts as two-factor verified.
  if r is null and claims ->> 'aal' = 'aal1'
     and exists (select 1 from mfa_backup_sessions where session_id = nullif(claims ->> 'session_id', '')::uuid) then
    claims := jsonb_set(claims, '{aal}', '"aal2"');
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;

-- ───────── Sessions ─────────
-- Deleting a session revokes its refresh tokens; its short-lived access token expires on its own.
create or replace function public.revoke_sessions(p_user uuid, p_keep uuid default null, p_only uuid default null) returns int
language plpgsql security definer set search_path = public, auth as $$
declare
  n int;
begin
  delete from auth.sessions
  where user_id = p_user
    and (p_keep is null or id <> p_keep)
    and (p_only is null or id = p_only);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.password_changed(p_customer uuid, p_current_session uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update customers set password_changed_at = now() where id = p_customer;
  update devices set revoked_at = now() where customer_id = p_customer and revoked_at is null
    and session_id is distinct from p_current_session;
  perform public.revoke_sessions(p_customer, p_keep => p_current_session);
  perform public.start_withdrawal_hold(p_customer, 'Password changed · other devices signed out');
end $$;

create or replace function public.device_revoke(p_customer uuid, p_device uuid, p_current_session uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  d devices;
begin
  select * into d from devices where id = p_device and customer_id = p_customer and revoked_at is null for update;
  if not found then raise exception 'Device not found' using errcode = 'P0002'; end if;
  if d.session_id = p_current_session then raise exception 'You can’t sign out the device you’re using here.' using errcode = '22023'; end if;
  update devices set revoked_at = now() where id = d.id;
  if d.session_id is not null then perform public.revoke_sessions(p_customer, p_only => d.session_id); end if;
  perform public.security_event(p_customer, 'Signed out · ' || d.name);
  return d.session_id;
end $$;

-- Records the device for a session the first time it calls a function, so Security can list and revoke it.
create or replace function public.touch_device(p_customer uuid, p_session uuid, p_name text, p_kind text, p_location text) returns public.devices
language plpgsql security definer set search_path = public as $$
declare
  d devices;
begin
  update devices set last_active_at = now() where customer_id = p_customer and session_id = p_session and revoked_at is null returning * into d;
  if found then return d; end if;
  insert into devices (customer_id, name, kind, location, session_id, withdrawals_paused_until)
  values (p_customer, left(p_name, 60), p_kind, left(p_location, 60), p_session,
    -- a brand-new device can't withdraw for 24 hours unless it is the customer's first device
    case when exists (select 1 from devices where customer_id = p_customer) then now() + interval '24 hours' end)
  returning * into d;
  if d.withdrawals_paused_until is not null then
    perform public.security_event(p_customer, 'New sign-in · ' || d.name, d.location);
    insert into notifications (customer_id, type, tone, icon, title, body, link)
    values (p_customer, 'security', 'warn', 'phone', 'New sign-in on ' || d.name,
      'If this wasn’t you, change your password now. Withdrawals from this device are paused for 24 hours.', '/security');
  end if;
  return d;
end $$;

-- ───────── 2FA turn-off: takes effect after 24 hours, cancellable ─────────
alter table public.customers add column if not exists mfa_disable_at timestamptz;

create or replace function public.request_mfa_disable(p_customer uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  at timestamptz := now() + interval '24 hours';
begin
  update customers set mfa_disable_at = at where id = p_customer and mfa_disable_at is null;
  -- Withdrawals pause for the same 24 hours (design copy on Security).
  perform public.start_withdrawal_hold(p_customer, 'Two-factor turn-off requested');
  return (select mfa_disable_at from customers where id = p_customer);
end $$;

create or replace function public.cancel_mfa_disable(p_customer uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update customers set mfa_disable_at = null where id = p_customer and mfa_disable_at is not null;
  if found then perform public.security_event(p_customer, 'Two-factor turn-off cancelled'); end if;
end $$;

create or replace function public.apply_mfa_disable() returns int
language plpgsql security definer set search_path = public, auth as $$
declare
  c record;
  n int := 0;
begin
  for c in select id from customers where mfa_disable_at <= now() for update skip locked loop
    delete from auth.mfa_factors where user_id = c.id;
    update customers set mfa_disable_at = null where id = c.id;
    perform public.security_event(c.id, 'Two-factor turned off');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Withdrawals need the authenticator, so they stop while 2FA is off.
create or replace function public.has_totp(p_user uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.mfa_factors where user_id = p_user and factor_type = 'totp' and status = 'verified')
$$;

-- ───────── Reconciliation ─────────
alter table public.recon_exceptions add column if not exists amount_drops bigint check (amount_drops is null or amount_drops > 0);
create sequence if not exists public.ref_seq_rc start 413;

create or replace function public.recon_record(p_validated_ledger bigint, p_result jsonb, p_exceptions jsonb, p_actor text)
returns public.recon_runs language plpgsql security definer set search_path = public as $$
declare
  run recon_runs;
  e jsonb;
begin
  insert into recon_runs (ref, validated_ledger, result)
  values ('RC-' || to_char(now() at time zone 'Africa/Lagos', 'YYYYMMDD') || '-' || nextval('ref_seq_rc'), p_validated_ledger, p_result)
  returning * into run;
  for e in select * from jsonb_array_elements(p_exceptions) loop
    -- One open exception per transaction and kind; reruns don't duplicate it.
    if not exists (select 1 from recon_exceptions where status <> 'resolved' and kind = e ->> 'kind'
                   and transaction_id is not distinct from nullif(e ->> 'transaction_id', '')::uuid
                   and title = e ->> 'title') then
      insert into recon_exceptions (run_id, kind, title, note, transaction_id, amount_drops)
      values (run.id, e ->> 'kind', e ->> 'title', e ->> 'note', nullif(e ->> 'transaction_id', '')::uuid, nullif(e ->> 'amount_drops', '')::bigint);
    end if;
  end loop;
  perform public.audit(case when p_actor = 'System' then 'system' else 'staff' end::actor_type, p_actor, p_actor,
    public.app_role(), 'Ran reconciliation', run.ref, jsonb_build_object('exceptions', jsonb_array_length(p_exceptions)));
  return run;
end $$;

-- Operations books an unbooked network fee: Dr fee revenue / Cr omnibus, with a reason. Compliance reviews it in the audit log.
create or replace function public.recon_adjust(p_exception uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  x recon_exceptions;
  entry uuid;
begin
  if public.app_role() <> 'operations' then
    raise exception 'Fee adjustments are posted by Operations.' using errcode = '42501';
  end if;
  if length(coalesce(trim(p_reason), '')) < 10 then raise exception 'Give a reason of at least 10 characters.' using errcode = '22023'; end if;
  select * into x from recon_exceptions where id = p_exception for update;
  if not found then raise exception 'Exception not found' using errcode = 'P0002'; end if;
  if x.kind <> 'unbooked_fee' or x.status = 'resolved' or x.amount_drops is null then
    raise exception 'Only an open unbooked-fee exception can be adjusted.' using errcode = '22023';
  end if;
  entry := public.post_entry('adjustment', (select ref from recon_runs where id = x.run_id), x.transaction_id, coalesce(public.staff_name(), 'Staff'),
    jsonb_build_array(jsonb_build_object('kind', 'fee_revenue', 'amount', x.amount_drops), jsonb_build_object('kind', 'omnibus', 'amount', -x.amount_drops)),
    p_reason);
  update recon_exceptions set status = 'resolved', status_note = 'Adjustment posted', resolved_at = now() where id = x.id;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), public.app_role(),
    'Posted fee adjustment journal', (select ref from recon_runs where id = x.run_id), jsonb_build_object('reason', p_reason, 'amount_drops', x.amount_drops));
  return entry;
end $$;

create or replace function public.recon_contact(p_exception uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  x recon_exceptions;
  tx_ref text;
begin
  if public.app_role() not in ('operations', 'compliance') then raise exception 'Not authorised.' using errcode = '42501'; end if;
  update recon_exceptions set status = 'investigating',
    status_note = 'Investigating · provider contacted ' || to_char(now() at time zone 'Africa/Lagos', 'HH24:MI')
  where id = p_exception and status <> 'resolved' returning * into x;
  if x.id is null then raise exception 'Exception not found' using errcode = 'P0002'; end if;
  select ref into tx_ref from transactions where id = x.transaction_id;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), public.app_role(),
    'Contacted provider about delay', coalesce(tx_ref, x.title));
end $$;

create or replace function public.audit_export_logged(p_filter text, p_rows int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), public.app_role(),
    'Exported audit log (CSV)', 'Audit log', jsonb_build_object('filter', p_filter, 'rows', p_rows));
end $$;

-- apply_mfa_disable runs every 5 minutes from the XRPL worker (public.run_job).

revoke execute on function public.revoke_sessions, public.password_changed, public.device_revoke, public.touch_device,
  public.request_mfa_disable, public.cancel_mfa_disable, public.apply_mfa_disable, public.has_totp, public.recon_record
  from anon, authenticated, public;
grant execute on function public.recon_adjust, public.recon_contact, public.audit_export_logged to authenticated;
