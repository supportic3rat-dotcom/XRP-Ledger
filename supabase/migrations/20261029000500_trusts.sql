-- Crypto trust (owner's decision, 2026-10-29): before an account or a wallet connection, the customer creates a
-- trust: its type, their personal details and address, and beneficiaries whose allocations add up to 100%.
-- Staff see it all on the customer's profile, masked by role like the rest of the record.

alter table public.customers add column if not exists address_line text;
alter table public.customers add column if not exists city text;
alter table public.customers add column if not exists region text;
alter table public.customers add column if not exists postal_code text;

create sequence if not exists public.trust_ref_seq;

create table public.trusts (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  customer_id uuid not null unique references public.customers (id),
  trust_type text not null check (trust_type in ('revocable', 'irrevocable', 'spendthrift')),
  status text not null default 'active' check (status in ('active')),
  terms_agreed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.trust_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  trust_id uuid not null references public.trusts (id),
  is_self boolean not null default false,
  name text not null check (length(trim(name)) between 1 and 120),
  relationship text not null check (relationship in ('self', 'spouse', 'child', 'parent', 'sibling', 'friend', 'charity', 'other')),
  email text check (email is null or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  allocation_pct int not null check (allocation_pct between 1 and 100),
  wallet text check (wallet is null or wallet ~ '^[A-Za-z0-9:._-]{10,130}$'),
  sort int not null default 0
);
create index on public.trust_beneficiaries (trust_id);

alter table public.trusts enable row level security;
alter table public.trust_beneficiaries enable row level security;
create policy own_trust on public.trusts for select to authenticated using (customer_id = auth.uid());
create policy own_beneficiaries on public.trust_beneficiaries for select to authenticated
  using (exists (select 1 from public.trusts t where t.id = trust_id and t.customer_id = auth.uid()));

-- The signed-in customer creates their trust (once). Personal details and address go on their customer record.
create or replace function public.create_trust(
  p_trust_type text, p_first_name text, p_last_name text, p_phone text, p_dob date,
  p_address text, p_city text, p_region text, p_postal_code text, p_country text, p_beneficiaries jsonb
) returns public.trusts language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c customers;
  t trusts;
  b jsonb;
  total int := 0;
  selves int := 0;
  n int := 0;
  v_name text := trim(coalesce(p_first_name, '')) || ' ' || trim(coalesce(p_last_name, ''));
begin
  select * into c from customers where id = me for update;
  if not found then raise exception 'Sign in to create your trust.' using errcode = '42501'; end if;
  if exists (select 1 from trusts where customer_id = me) then raise exception 'You already have a trust.' using errcode = '22023'; end if;
  if p_trust_type not in ('revocable', 'irrevocable', 'spendthrift') then raise exception 'Choose a trust type.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_first_name, ''))) = 0 or length(trim(coalesce(p_last_name, ''))) = 0 then
    raise exception 'Enter your first and last name.' using errcode = '22023';
  end if;
  if regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') !~ '^[0-9]{6,15}$' then raise exception 'Enter a valid phone number.' using errcode = '22023'; end if;
  if p_dob is null or p_dob > (current_date - interval '18 years') or p_dob < (current_date - interval '120 years') then
    raise exception 'You must be 18 or older to create a trust.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_address, ''))) = 0 or length(trim(coalesce(p_city, ''))) = 0 or length(trim(coalesce(p_region, ''))) = 0
     or length(trim(coalesce(p_postal_code, ''))) = 0 then
    raise exception 'Enter your full address.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_beneficiaries) <> 'array' or jsonb_array_length(p_beneficiaries) = 0 or jsonb_array_length(p_beneficiaries) > 10 then
    raise exception 'Add between 1 and 10 beneficiaries.' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(p_beneficiaries) loop
    if coalesce((b ->> 'is_self')::boolean, false) then selves := selves + 1; end if;
    if coalesce((b ->> 'allocation_pct')::int, 0) not between 1 and 100 then
      raise exception 'Each beneficiary’s share must be between 1%% and 100%%.' using errcode = '22023';
    end if;
    total := total + (b ->> 'allocation_pct')::int;
  end loop;
  if selves > 1 then raise exception 'You can only add yourself once.' using errcode = '22023'; end if;
  if total <> 100 then raise exception 'The shares add up to % percent; they must total 100%%.', total using errcode = '22023'; end if;

  update customers set
    full_name = v_name, display_name = trim(p_first_name),
    phone = trim(p_phone), dob = p_dob,
    address_line = trim(p_address), city = trim(p_city), region = trim(p_region), postal_code = trim(p_postal_code),
    country = coalesce(nullif(upper(trim(p_country)), ''), c.country)
  where id = me returning * into c;

  insert into trusts (ref, customer_id, trust_type, terms_agreed_at)
  values ('TR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('trust_ref_seq')::text, 5, '0'), me, p_trust_type, now())
  returning * into t;
  for b in select * from jsonb_array_elements(p_beneficiaries) loop
    insert into trust_beneficiaries (trust_id, is_self, name, relationship, email, allocation_pct, wallet, sort)
    values (
      t.id,
      coalesce((b ->> 'is_self')::boolean, false),
      case when coalesce((b ->> 'is_self')::boolean, false) then c.full_name else trim(b ->> 'name') end,
      case when coalesce((b ->> 'is_self')::boolean, false) then 'self' else b ->> 'relationship' end,
      nullif(trim(coalesce(b ->> 'email', '')), ''),
      (b ->> 'allocation_pct')::int,
      nullif(trim(coalesce(b ->> 'wallet', '')), ''),
      n);
    n := n + 1;
  end loop;

  insert into notifications (customer_id, type, tone, icon, title, body, link)
  values (me, 'account', 'ok', 'shieldCheck', 'Your trust is set up',
          initcap(p_trust_type) || ' trust ' || t.ref || ' with ' || n || ' beneficiar' || case when n = 1 then 'y' else 'ies' end || '.', '/profile');
  perform public.audit('customer', c.account_ref, c.account_ref, null, 'Created ' || p_trust_type || ' trust', t.ref,
    jsonb_build_object('beneficiaries', n));
  return t;
end $$;

revoke execute on function public.create_trust from public, anon;
grant execute on function public.create_trust(text, text, text, text, date, text, text, text, text, text, jsonb) to authenticated;

-- Everything staff see on a customer's profile, masked by role: Compliance in full, Operations partly, Auditors least.
create or replace function public.staff_customer_profile(p_customer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  c customers;
  t trusts;
  mask_email text;
begin
  if not public.is_staff() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  select * into c from customers where id = p_customer;
  if not found then raise exception 'Customer not found' using errcode = 'P0002'; end if;
  select * into t from trusts where customer_id = p_customer;
  return jsonb_build_object(
    'address', case r
      when 'compliance' then jsonb_build_object('line', c.address_line, 'city', c.city, 'region', c.region, 'postal_code', c.postal_code, 'country', c.country)
      when 'operations' then jsonb_build_object('line', case when c.address_line is null then null else '•••' end, 'city', c.city, 'region', c.region,
                                                 'postal_code', case when c.postal_code is null then null else left(c.postal_code, 2) || '•••' end, 'country', c.country)
      else jsonb_build_object('country', c.country) end,
    'trust', case when t.id is null then null else jsonb_build_object('ref', t.ref, 'type', t.trust_type, 'status', t.status,
      'created_at', t.created_at, 'terms_agreed_at', t.terms_agreed_at) end,
    'beneficiaries', coalesce((select jsonb_agg(jsonb_build_object(
        'name', public.mask_name(b.name, r),
        'relationship', b.relationship,
        'is_self', b.is_self,
        'allocation_pct', b.allocation_pct,
        'email', case when b.email is null then null when r = 'compliance' then b.email
                      when r = 'operations' then left(b.email, 2) || '•••@' || split_part(b.email, '@', 2)
                      else '•••@' || split_part(b.email, '@', 2) end,
        'wallet', case when b.wallet is null then null when r = 'compliance' then b.wallet else left(b.wallet, 6) || '…' || right(b.wallet, 4) end)
      order by b.sort) from trust_beneficiaries b where b.trust_id = t.id), '[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(jsonb_build_object('network', w.network, 'access', w.access,
        'address', case when r = 'compliance' then w.address else left(w.address, 6) || '…' || right(w.address, 4) end,
        'balances', w.balances) order by w.created_at)
      from external_wallets w where w.customer_id = p_customer and w.removed_at is null), '[]'::jsonb));
end $$;

revoke execute on function public.staff_customer_profile from public, anon;
grant execute on function public.staff_customer_profile(uuid) to authenticated;
