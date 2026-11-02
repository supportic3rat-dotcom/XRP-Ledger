-- A submission waits here until every file has arrived. Only then does it become a check for Compliance and put the
-- customer under review, so a failed upload changes nothing.
create table public.kyc_pending (
  provider_ref text primary key,
  customer_id uuid not null references public.customers (id),
  document_type text,
  issuing_country text,
  documents text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.kyc_pending enable row level security;

drop function public.kyc_started(uuid, text, text, text, text[]);
create function public.kyc_started(p_customer uuid, p_provider_ref text, p_document_type text, p_country text, p_documents text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select kyc_status from customers where id = p_customer) = 'verified' then
    raise exception 'Your identity is already verified.' using errcode = '22023';
  end if;
  delete from kyc_pending where customer_id = p_customer;
  insert into kyc_pending (provider_ref, customer_id, document_type, issuing_country, documents)
  values (p_provider_ref, p_customer, p_document_type, p_country, p_documents);
end $$;

-- Returns the account reference the first time, and null on a retry, so Compliance is alerted once.
create function public.kyc_submitted(p_customer uuid, p_provider_ref text)
returns text language plpgsql security definer set search_path = public as $$
declare
  p kyc_pending;
  v_ref text;
begin
  delete from kyc_pending where provider_ref = p_provider_ref and customer_id = p_customer returning * into p;
  if not found then
    if exists (select 1 from kyc_checks where provider_ref = p_provider_ref and customer_id = p_customer) then return null; end if;
    raise exception 'Unknown verification session' using errcode = 'P0002';
  end if;
  insert into kyc_checks (customer_id, provider_ref, status, document_type, issuing_country, documents)
  values (p_customer, p_provider_ref, 'in_progress', p.document_type, p.issuing_country, p.documents);
  update customers set kyc_status = 'in_progress' where id = p_customer returning account_ref into v_ref;
  return v_ref;
end $$;

-- Phones that get Compliance alerts. A sign-out keeps the token, because alerts matter most when nobody is signed in;
-- sending checks the current role.
create table public.staff_push_tokens (
  token text primary key,
  staff_id uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.staff_push_tokens enable row level security;

create function public.staff_push_register(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() is distinct from 'compliance' then raise exception 'Only Compliance gets these alerts.' using errcode = '42501'; end if;
  if p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$' then raise exception 'That isn’t a push token.' using errcode = '22023'; end if;
  insert into staff_push_tokens (token, staff_id) values (p_token, auth.uid())
  on conflict (token) do update set staff_id = excluded.staff_id, updated_at = now();
end $$;

create function public.compliance_push_tokens()
returns table (token text) language sql security definer set search_path = public as $$
  select t.token from staff_push_tokens t join staff_roles r on r.staff_id = t.staff_id where r.role = 'compliance';
$$;

revoke execute on function public.kyc_started(uuid, text, text, text, text[]), public.kyc_submitted(uuid, text),
  public.compliance_push_tokens(), public.staff_push_register(text) from public, anon, authenticated;
grant execute on function public.kyc_started(uuid, text, text, text, text[]), public.kyc_submitted(uuid, text),
  public.compliance_push_tokens() to service_role;
grant execute on function public.staff_push_register(text) to authenticated;
