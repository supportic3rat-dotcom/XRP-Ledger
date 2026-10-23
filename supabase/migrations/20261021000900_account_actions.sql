-- Account and support actions called by Edge Functions (service role). Each writes its security event or
-- audit entry in the same transaction as the change.

create or replace function public.security_event(p_customer uuid, p_title text, p_meta text default null) returns void
language sql security definer set search_path = public as $$
  insert into security_events (customer_id, title, meta)
  values (p_customer, p_title, coalesce(p_meta, to_char(now() at time zone 'Africa/Lagos', 'Mon FMDD · HH24:MI')));
$$;

-- Password change or 2FA off: withdrawals pause for 24 hours.
create or replace function public.start_withdrawal_hold(p_customer uuid, p_reason text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  until timestamptz := now() + interval '24 hours';
begin
  update customers set withdrawals_hold_until = greatest(coalesce(withdrawals_hold_until, until), until) where id = p_customer;
  perform public.security_event(p_customer, p_reason || ' · 24-hour hold');
  return until;
end $$;

create or replace function public.password_changed(p_customer uuid, p_current_session uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update customers set password_changed_at = now() where id = p_customer;
  update devices set revoked_at = now() where customer_id = p_customer and revoked_at is null
    and session_id is distinct from p_current_session;
  perform public.start_withdrawal_hold(p_customer, 'Password changed · other devices signed out');
end $$;

-- Replaces every unused backup code with a new set (bcrypt). Old codes stop working at once.
create or replace function public.set_backup_codes(p_user uuid, p_codes text[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  gen int;
begin
  if array_length(p_codes, 1) is distinct from 8 then raise exception 'Expected 8 codes' using errcode = '22023'; end if;
  select coalesce(max(generation), 0) + 1 into gen from auth_backup_codes where user_id = p_user;
  update auth_backup_codes set used_at = now() where user_id = p_user and used_at is null;
  insert into auth_backup_codes (user_id, code_hash, generation)
  select p_user, crypt(upper(code), gen_salt('bf', 10)), gen from unnest(p_codes) as code;
  perform public.security_event(p_user, 'New backup codes generated');
  return gen;
end $$;

create or replace function public.set_allowlist(p_customer uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update customers set allowlist_enabled = p_enabled where id = p_customer;
  perform public.security_event(p_customer, case when p_enabled then 'Withdrawal allowlist turned on' else 'Withdrawal allowlist turned off' end);
end $$;

-- New addresses activate after 24 hours.
create or replace function public.allowlist_add(p_customer uuid, p_label text, p_address text, p_tag bigint) returns public.allowlist_addresses
language plpgsql security definer set search_path = public as $$
declare
  a allowlist_addresses;
begin
  if exists (select 1 from allowlist_addresses where customer_id = p_customer and address = p_address
             and coalesce(tag, -1) = coalesce(p_tag, -1) and removed_at is null) then
    raise exception 'That address is already saved.' using errcode = '22023';
  end if;
  insert into allowlist_addresses (customer_id, label, address, tag) values (p_customer, trim(p_label), p_address, p_tag) returning * into a;
  perform public.security_event(p_customer, 'Allowlist address added · ' || a.label);
  return a;
end $$;

create or replace function public.allowlist_remove(p_customer uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  label text;
begin
  update allowlist_addresses set removed_at = now() where id = p_id and customer_id = p_customer and removed_at is null returning allowlist_addresses.label into label;
  if label is null then raise exception 'Address not found' using errcode = 'P0002'; end if;
  perform public.security_event(p_customer, 'Allowlist address removed · ' || label);
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
  perform public.security_event(p_customer, 'Signed out · ' || d.name);
  return d.session_id;
end $$;

-- ───────── Support ─────────
create or replace function public.ticket_create(p_customer uuid, p_topic text, p_transaction_ref text, p_message text, p_contact_email text default null)
returns public.support_tickets language plpgsql security definer set search_path = public as $$
declare
  t support_tickets;
begin
  if length(trim(p_message)) < 20 then raise exception 'Tell us a little more (at least 20 characters).' using errcode = '22023'; end if;
  if p_transaction_ref is not null and not exists (select 1 from transactions where ref = p_transaction_ref and customer_id = p_customer) then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  insert into support_tickets (ref, customer_id, topic, subject, transaction_ref, status)
  values (public.next_ref('SUP'), p_customer, p_topic, left(regexp_replace(trim(p_message), '\s+', ' ', 'g'), 60), p_transaction_ref, 'waiting_on_us')
  returning * into t;
  insert into ticket_messages (ticket_ref, author, body) values (t.ref, 'customer', trim(p_message));
  insert into ticket_messages (ticket_ref, author, body)
  values (t.ref, 'auto', 'Thanks, we’ve got your message. We usually reply within 4 hours.');
  return t;
end $$;

create or replace function public.ticket_reply(p_customer uuid, p_ref text, p_message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from support_tickets where ref = p_ref and customer_id = p_customer) then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;
  insert into ticket_messages (ticket_ref, author, body) values (p_ref, 'customer', trim(p_message));
  update support_tickets set status = 'waiting_on_us' where ref = p_ref and status <> 'resolved';
end $$;

-- Signed-out contact form: no customer record, so it lands in a public inbox table.
create table if not exists public.public_contact_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic text not null,
  message text not null check (length(message) between 20 and 4000),
  created_at timestamptz not null default now()
);
alter table public.public_contact_requests enable row level security;
create policy staff_read on public.public_contact_requests for select to authenticated using (public.is_staff());

-- ───────── Legal ─────────
create or replace function public.consent_accept(p_customer uuid, p_document text, p_version text, p_surface text) returns public.consents
language plpgsql security definer set search_path = public as $$
declare
  c consents;
begin
  if not exists (select 1 from legal_documents where id = p_document and current_version = p_version) then
    raise exception 'That document version is no longer current. Reopen it and try again.' using errcode = '22023';
  end if;
  select * into c from consents where customer_id = p_customer and document = p_document and version = p_version;
  if found then return c; end if;
  insert into consents (id, customer_id, document, version, surface)
  values (public.next_ref('CNS'), p_customer, p_document, p_version, p_surface) returning * into c;
  return c;
end $$;

-- ───────── External wallets (read-only; never custodial) ─────────
create or replace function public.external_wallet_set(p_customer uuid, p_address text, p_access text, p_add boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_add then
    if exists (select 1 from external_wallets where customer_id = p_customer and address = p_address and removed_at is null) then
      update external_wallets set access = p_access where customer_id = p_customer and address = p_address and removed_at is null;
    else
      insert into external_wallets (customer_id, address, access) values (p_customer, p_address, p_access);
    end if;
  else
    update external_wallets set removed_at = now() where customer_id = p_customer and address = p_address and removed_at is null;
  end if;
end $$;

-- ───────── KYC ─────────
create or replace function public.kyc_started(p_customer uuid, p_provider_ref text, p_document_type text, p_country text, p_documents text[])
returns public.kyc_checks language plpgsql security definer set search_path = public as $$
declare
  k kyc_checks;
begin
  if (select kyc_status from customers where id = p_customer) = 'verified' then
    raise exception 'Your identity is already verified.' using errcode = '22023';
  end if;
  insert into kyc_checks (customer_id, provider_ref, status, document_type, issuing_country, documents)
  values (p_customer, p_provider_ref, 'in_progress', p_document_type, p_country, p_documents) returning * into k;
  update customers set kyc_status = 'in_progress' where id = p_customer;
  return k;
end $$;

create or replace function public.kyc_decided(p_provider_ref text, p_decision public.kyc_status) returns void
language plpgsql security definer set search_path = public as $$
declare
  k kyc_checks;
begin
  update kyc_checks set status = p_decision, decided_at = case when p_decision in ('verified', 'rejected') then now() end
  where provider_ref = p_provider_ref returning * into k;
  if k.id is null then raise exception 'Unknown verification session' using errcode = 'P0002'; end if;
  update customers set kyc_status = p_decision, kyc_level = case when p_decision = 'verified' then 2 else kyc_level end where id = k.customer_id;
  insert into notifications (customer_id, type, tone, icon, title, body, link)
  select k.customer_id, 'account', case p_decision when 'verified' then 'ok' when 'rejected' then 'bad' else 'warn' end, 'idCard',
    case p_decision when 'verified' then 'Identity verified' when 'rejected' then 'We couldn’t verify your identity' else 'We need a little more information' end,
    case p_decision when 'verified' then 'You can now deposit, withdraw and use every product.'
      when 'rejected' then 'Open the app to see why and what you can do next.' else 'Open the app to add what’s missing.' end,
    '/verify'
  where p_decision in ('verified', 'rejected', 'more_info');
  perform public.audit('system', '[KYC provider]', '[KYC provider]', null, 'Identity ' || p_decision::text, (select account_ref from customers where id = k.customer_id));
end $$;

-- Customer-facing RPCs here are only for the service role.
revoke execute on function public.security_event, public.start_withdrawal_hold, public.password_changed, public.set_backup_codes,
  public.set_allowlist, public.allowlist_add, public.allowlist_remove, public.device_revoke, public.ticket_create, public.ticket_reply,
  public.consent_accept, public.external_wallet_set, public.kyc_started, public.kyc_decided from anon, authenticated, public;
