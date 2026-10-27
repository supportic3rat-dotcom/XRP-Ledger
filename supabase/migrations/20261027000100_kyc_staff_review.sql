-- Identity checks are decided by Compliance in the console (owner's decision, 2026-10-27): there is no live KYC
-- provider, so its webhook never arrives. Compliance looks at the uploaded documents and verifies, asks for more,
-- or rejects. The provider webhook path (kyc_decided) stays for when a provider is contracted.

create or replace function public.kyc_review(p_customer uuid, p_decision public.kyc_status, p_note text)
returns public.kyc_checks language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  who text := coalesce(public.staff_name(), 'Staff');
  k kyc_checks;
  c customers;
  note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if r is distinct from 'compliance' then raise exception 'Only Compliance can decide identity checks.' using errcode = '42501'; end if;
  if p_decision not in ('verified', 'more_info', 'rejected') then
    raise exception 'Choose verify, ask for more, or reject.' using errcode = '22023';
  end if;
  if p_decision <> 'verified' and coalesce(length(note), 0) < 10 then
    raise exception 'Write a short reason — the customer sees it and it goes into the audit log.' using errcode = '22023';
  end if;
  select * into c from customers where id = p_customer for update;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;
  select * into k from kyc_checks where customer_id = p_customer order by created_at desc limit 1 for update;
  if not found then raise exception 'This customer hasn’t submitted documents yet.' using errcode = '22023'; end if;
  if k.status <> 'in_progress' then raise exception 'This identity check has already been decided.' using errcode = '22023'; end if;

  update kyc_checks set status = p_decision, decided_at = now() where id = k.id returning * into k;
  update customers set kyc_status = p_decision, kyc_level = case when p_decision = 'verified' then 2 else kyc_level end where id = p_customer;
  insert into notifications (customer_id, type, tone, icon, title, body, link) values (
    p_customer, 'account', case p_decision when 'verified' then 'ok' when 'rejected' then 'bad' else 'warn' end, 'idCard',
    case p_decision when 'verified' then 'Identity verified' when 'rejected' then 'We couldn’t verify your identity' else 'We need a little more information' end,
    case p_decision when 'verified' then 'You can now deposit, withdraw and use every product.' else note end,
    '/verify');
  perform public.audit('staff', auth.uid()::text, who, r,
    case p_decision when 'verified' then 'Verified identity' when 'rejected' then 'Rejected identity check' else 'Asked for more identity information' end,
    c.account_ref, jsonb_strip_nulls(jsonb_build_object('note', note, 'document_type', k.document_type, 'country', k.issuing_country)));
  return k;
end $$;

revoke execute on function public.kyc_review from public, anon;
grant execute on function public.kyc_review(uuid, public.kyc_status, text) to authenticated;

-- Account references: ACC- plus 10 hex characters derived from the user id, retried until unique (two ids can
-- share their first characters, which made a sign-up fail on the unique reference).
create or replace function public.create_customer_for_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := btrim(coalesce(m ->> 'full_name', ''));
  v_tag bigint;
  v_ref text;
  n int := 0;
begin
  if v_name = '' then return new; end if;
  -- Destination tags identify XRP deposits, so each customer needs a unique one.
  loop
    v_tag := 1 + floor(random() * 4294967294)::bigint;
    exit when not exists (select 1 from customers where destination_tag = v_tag);
  end loop;
  loop
    v_ref := 'ACC-' || upper(substr(md5(new.id::text || n::text), 1, 10));
    exit when not exists (select 1 from customers where account_ref = v_ref);
    n := n + 1;
  end loop;
  insert into customers (id, account_ref, full_name, display_name, email, country, display_currency, destination_tag, marketing_opt_in)
  values (
    new.id,
    v_ref,
    v_name,
    split_part(v_name, ' ', 1),
    coalesce(new.email, ''),
    coalesce(nullif(m ->> 'country', ''), 'OTHER'),
    case when m ->> 'display_currency' in ('USD', 'NGN', 'GBP', 'EUR') then m ->> 'display_currency' else 'USD' end,
    v_tag,
    coalesce((m ->> 'marketing_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
