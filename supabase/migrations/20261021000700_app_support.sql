-- Small read models the mobile app needs.

-- External wallet balances are refreshed by the XRPL worker from the public ledger (read-only, never custodial).
alter table public.external_wallets add column if not exists balance_drops bigint not null default 0;
alter table public.external_wallets add column if not exists balance_at timestamptz;

-- Unused backup-code count for the signed-in user (hashes never leave the database).
create or replace view public.auth_backup_codes_status with (security_barrier = true) as
select count(*) filter (where used_at is null)::int as unused, count(*)::int as total
from public.auth_backup_codes
where user_id = auth.uid();
grant select on public.auth_backup_codes_status to authenticated;

-- Verifies a backup code (bcrypt) and marks it used, in one statement so a code works exactly once.
create or replace function public.consume_backup_code(p_user uuid, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  hit uuid;
begin
  select id into hit from auth_backup_codes
  where user_id = p_user and used_at is null and code_hash = crypt(upper(p_code), code_hash)
  for update skip locked limit 1;
  if hit is null then return false; end if;
  update auth_backup_codes set used_at = now() where id = hit;
  insert into security_events (customer_id, title, meta) values (p_user, 'Signed in with a backup code', to_char(now() at time zone 'Africa/Lagos', 'Mon DD · HH24:MI'));
  return true;
end $$;
revoke execute on function public.consume_backup_code from anon, authenticated, public;
