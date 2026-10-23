-- Hash-chained audit log, separation-of-duties approvals and staff role helpers.

-- ───────── Audit chain: hash = sha256(prev_hash || canonical row) ─────────
create or replace function public.audit_canonical(e public.audit_events) returns text
language sql immutable as $$
  select concat_ws('|', to_char(e.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), e.actor_type::text, e.actor_id,
                   e.actor_name, coalesce(e.role, ''), e.action, e.target, e.payload::text)
$$;

create or replace function public.audit_chain() returns trigger
language plpgsql as $$
declare
  last_hash text;
begin
  perform pg_advisory_xact_lock(hashtext('audit_events_chain'));
  select hash into last_hash from public.audit_events order by id desc limit 1;
  new.prev_hash := coalesce(last_hash, repeat('0', 64));
  new.hash := encode(digest(new.prev_hash || public.audit_canonical(new), 'sha256'), 'hex');
  return new;
end $$;

create trigger audit_events_chain before insert on public.audit_events
for each row execute function public.audit_chain();

create or replace function public.audit(
  p_actor_type public.actor_type, p_actor_id text, p_actor_name text, p_role text, p_action text, p_target text,
  p_payload jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = public as $$
  insert into audit_events (actor_type, actor_id, actor_name, role, action, target, payload, prev_hash, hash)
  values (p_actor_type, p_actor_id, p_actor_name, p_role, p_action, p_target, p_payload, '', '');
$$;

-- Nightly verification: returns the first broken id, or null when the chain is intact.
create or replace function public.verify_audit_chain() returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  e audit_events;
  prev text := repeat('0', 64);
begin
  for e in select * from audit_events order by id loop
    if e.prev_hash <> prev or e.hash <> encode(digest(prev || audit_canonical(e), 'sha256'), 'hex') then
      return e.id;
    end if;
    prev := e.hash;
  end loop;
  return null;
end $$;

create table public.audit_verifications (
  id bigint generated always as identity primary key,
  broken_at_id bigint,
  entries bigint not null,
  verified_at timestamptz not null default now()
);

create or replace function public.run_audit_verification() returns void
language sql security definer set search_path = public as $$
  insert into audit_verifications (broken_at_id, entries) select verify_audit_chain(), count(*) from audit_events;
$$;

-- ───────── Staff role helpers (role comes from the JWT claim set by the access-token hook) ─────────
create or replace function public.app_role() returns text
language sql stable as $$ select nullif(auth.jwt() ->> 'app_role', '') $$;

create or replace function public.is_staff() returns boolean
language sql stable as $$ select public.app_role() in ('operations', 'compliance', 'auditor') $$;

create or replace function public.staff_name() returns text
language sql stable security definer set search_path = public as $$
  select display_name from staff_roles where staff_id = auth.uid()
$$;

-- Custom access token hook: adds app_role for staff. Register in supabase/config.toml.
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
  return jsonb_set(event, '{claims}', claims);
end $$;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on public.staff_roles to supabase_auth_admin;

-- Which staff roles may decide which kinds (enforced here and mirrored in the UI).
create or replace function public.role_can_decide(p_role text, p_kind public.tx_kind) returns boolean
language sql immutable as $$
  select case p_role
    when 'operations' then p_kind in ('withdrawal', 'deposit', 'exchange', 'yield_allocate', 'yield_redeem')
    when 'compliance' then p_kind in ('withdrawal', 'deposit', 'loan')
    else false end
$$;

-- ───────── approval_decide: separation of duties in SQL ─────────
-- * nobody decides their own request
-- * the same person can't decide twice
-- * over 1,000 XRP: two approvals from different people, one of them Compliance; when Compliance is required,
--   the second approval can't come from the same role as the first.
-- * a rejection posts the compensating entry via transition_tx (reserved → available).
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
      null; -- unattributed deposit stays in suspense until attributed or returned
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
    raise exception 'Over 1,000 XRP: one approval must come from Compliance.' using errcode = '42501';
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
      when 'deposit' then perform public.attribute_deposit(t.id, (t.meta->>'claimed_by')::uuid, who);
      else null;
    end case;
    return jsonb_build_object('status', 'approved');
  end if;
  return jsonb_build_object('status', 'pending', 'approvals', approvals_so_far);
end $$;

-- Attributes an unattributed (no-tag) deposit held in suspense to a customer, then credits it.
create or replace function public.attribute_deposit(p_tx uuid, p_customer uuid, p_actor text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_customer is null then raise exception 'No claimant recorded for this deposit' using errcode = '22023'; end if;
  update transactions set customer_id = p_customer, meta = meta || '{"via_suspense": true}'::jsonb where id = p_tx and customer_id is null;
  perform public.transition_tx(p_tx, 'validated', p_actor, 'Attributed by staff');
  perform public.transition_tx(p_tx, 'screened', p_actor);
  perform public.transition_tx(p_tx, 'credited', p_actor);
end $$;

-- ───────── Signing policy changes: requested by one role, decided by Compliance, applies after 24 h ─────────
create or replace function public.policy_decide(p_change uuid, p_decision text) returns void
language plpgsql security definer set search_path = public as $$
declare
  pc policy_changes;
  r text := public.app_role();
begin
  if r <> 'compliance' then
    raise exception 'Separation of duties: requested by Operations, so it needs Compliance approval.' using errcode = '42501';
  end if;
  select * into pc from policy_changes where id = p_change for update;
  if pc.status <> 'pending' then raise exception 'Already decided' using errcode = '22023'; end if;
  if pc.requested_by = auth.uid() then raise exception 'You can’t approve a change you requested.' using errcode = '42501'; end if;
  update policy_changes set status = case when p_decision = 'approve' then 'approved' else 'declined' end,
    decided_by = auth.uid(), effective_at = case when p_decision = 'approve' then now() + interval '24 hours' end
  where id = pc.id;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), r,
    case when p_decision = 'approve' then 'Approved signing policy change' else 'Declined signing policy change' end, pc.ref);
end $$;

-- Freeze is Compliance only; flagging is Operations or Compliance.
create or replace function public.customer_freeze(p_customer uuid, p_frozen boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() <> 'compliance' then
    raise exception 'Only Compliance can freeze accounts.' using errcode = '42501';
  end if;
  update customers set frozen_at = case when p_frozen then now() end where id = p_customer;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), 'compliance',
    case when p_frozen then 'Froze account · withdrawals blocked' else 'Unfroze account' end,
    (select account_ref from customers where id = p_customer));
end $$;

create or replace function public.customer_flag(p_customer uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() not in ('operations', 'compliance') then
    raise exception 'Read-only role: you can view but not act.' using errcode = '42501';
  end if;
  insert into customer_flags (customer_id, note, created_by) values (p_customer, p_note, auth.uid());
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), public.app_role(),
    'Flagged customer for review', (select account_ref from customers where id = p_customer));
end $$;
