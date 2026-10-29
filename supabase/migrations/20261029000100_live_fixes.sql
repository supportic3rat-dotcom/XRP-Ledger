-- Fixes found by a live test on 2026-10-29.

-- 1. On Supabase, pgcrypto lives in the `extensions` schema, which these functions didn't search: every audit entry
--    failed (`digest` not found), so every audited action failed on the live project. The tests' database installs
--    pgcrypto in `public`, which hid it.
alter function public.audit_chain() set search_path = public, extensions;
alter function public.verify_audit_chain() set search_path = public, extensions;
alter function public.set_backup_codes(uuid, text[]) set search_path = public, extensions;
alter function public.consume_backup_code(uuid, text, uuid) set search_path = public, extensions;

-- 2. An account with no entries yet has a balance of 0, not null: a null made "more than your available balance"
--    checks pass for new customers (the ledger still refused the posting, but later and with a vaguer error).
create or replace function public.account_balance(p_account uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select balance_drops from balances where account_id = p_account), 0)
$$;
