-- Local currency (owner's decision, 2026-10-29): the country a customer picks sets the currency the app shows
-- values in, from any country, not just four. Money stays in USD; rates are only for display, refreshed hourly
-- by the upkeep function.

create table public.fx_rates (
  currency text primary key check (currency ~ '^[A-Z]{3}$'),
  per_usd numeric not null check (per_usd > 0),
  at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
create policy fx_rates_read on public.fx_rates for select to anon, authenticated using (true);
insert into public.fx_rates (currency, per_usd) values ('USD', 1);

alter table public.customers drop constraint if exists customers_display_currency_check;
alter table public.customers add constraint customers_display_currency_check check (display_currency ~ '^[A-Z]{3}$');

create or replace function public.set_display_currency(p_currency text) returns void
language sql security definer set search_path = public as $$
  update customers set display_currency = p_currency
  where id = auth.uid() and (p_currency = 'USD' or exists (select 1 from fx_rates where currency = p_currency));
$$;

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
    coalesce(nullif(upper(m ->> 'country'), ''), 'OTHER'),
    case when m ->> 'display_currency' ~ '^[A-Z]{3}$' then m ->> 'display_currency' else 'USD' end,
    v_tag,
    coalesce((m ->> 'marketing_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
