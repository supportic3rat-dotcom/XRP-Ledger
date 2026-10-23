-- A customer row for every app sign-up. The apps send full_name, country, display_currency and marketing_opt_in as
-- user metadata; users created without full_name (staff accounts, seed data) are left alone.

create or replace function public.create_customer_for_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := btrim(coalesce(m ->> 'full_name', ''));
  v_tag bigint;
begin
  if v_name = '' then return new; end if;
  -- Destination tags identify XRP deposits, so each customer needs a unique one.
  loop
    v_tag := 1 + floor(random() * 4294967294)::bigint;
    exit when not exists (select 1 from customers where destination_tag = v_tag);
  end loop;
  insert into customers (id, account_ref, full_name, display_name, email, country, display_currency, destination_tag, marketing_opt_in)
  values (
    new.id,
    'ACC-' || upper(substr(replace(new.id::text, '-', ''), 1, 10)),
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

revoke execute on function public.create_customer_for_signup() from public, anon, authenticated;

drop trigger if exists create_customer_for_signup on auth.users;
create trigger create_customer_for_signup after insert on auth.users
  for each row execute function public.create_customer_for_signup();
