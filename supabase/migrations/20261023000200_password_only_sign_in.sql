-- Sign-in is email and password only: staff roles no longer wait for a TOTP-verified (aal2) session.
-- RLS, approval_decide and every staff RPC go through app_role(), so this one change covers them all.
create or replace function public.app_role() returns text
language sql stable as $$
  select nullif(auth.jwt() ->> 'app_role', '')
$$;
