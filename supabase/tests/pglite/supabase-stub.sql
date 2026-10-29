-- Minimal stand-in for the parts of Supabase the migrations rely on (auth schema, roles, publication).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;
-- Supabase installs pgcrypto in `extensions`, not `public`; mirror that so functions must find it the same way.
create schema extensions;
create extension pgcrypto schema extensions;
create schema auth;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text, email_confirmed_at timestamptz,
  created_at timestamptz, updated_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, confirmation_token text,
  recovery_token text, email_change_token_new text, email_change text
);
create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create publication supabase_realtime;
create table auth.sessions (id uuid primary key, user_id uuid, created_at timestamptz default now(), aal text);
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, factor_type text, status text, created_at timestamptz default now());
