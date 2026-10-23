-- Core schema for the XRP Ledger custodial wallet.
-- Money is bigint drops (XRP, 1 XRP = 1,000,000 drops) or bigint cents (USD). No floats anywhere.

create extension if not exists pgcrypto;

-- ───────────────────────── Enums ─────────────────────────
create type public.kyc_status as enum ('not_started', 'in_progress', 'more_info', 'verified', 'rejected', 'restricted');
create type public.staff_role as enum ('operations', 'compliance', 'auditor');
create type public.account_kind as enum (
  'available', 'reserved', 'pending_yield', 'yield', 'collateral',
  'omnibus', 'suspense', 'fee_revenue', 'provider_receivable'
);
create type public.tx_kind as enum (
  'deposit', 'withdrawal', 'exchange', 'yield_allocate', 'yield_redeem', 'yield_reward', 'loan', 'loan_repay', 'loan_collateral'
);
create type public.actor_type as enum ('staff', 'customer', 'system');

-- ───────────────────────── Identity ─────────────────────────
create table public.customers (
  id uuid primary key references auth.users (id) on delete restrict,
  account_ref text not null unique,
  full_name text not null,
  display_name text not null,
  email text not null,
  phone text,
  dob date,
  country text not null,
  display_currency text not null default 'USD' check (display_currency in ('USD', 'NGN', 'GBP', 'EUR')),
  kyc_status public.kyc_status not null default 'not_started',
  kyc_level smallint not null default 0,
  risk_rating text not null default 'Not rated',
  destination_tag bigint not null unique check (destination_tag between 1 and 4294967295),
  allowlist_enabled boolean not null default false,
  password_changed_at timestamptz not null default now(),
  frozen_at timestamptz,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.staff_roles (
  staff_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.staff_role not null,
  created_at timestamptz not null default now()
);

create table public.auth_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null, -- bcrypt via crypt(code, gen_salt('bf'))
  used_at timestamptz,
  generation int not null default 1,
  created_at timestamptz not null default now()
);
create index on public.auth_backup_codes (user_id) where used_at is null;

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  name text not null,
  kind text not null check (kind in ('phone', 'laptop')),
  location text not null,
  session_id uuid,
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz,
  withdrawals_paused_until timestamptz
);

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  title text not null,
  meta text not null,
  created_at timestamptz not null default now()
);

create table public.kyc_checks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  provider_ref text not null,
  status public.kyc_status not null,
  document_type text,
  issuing_country text,
  documents text[] not null default '{}',
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Ledger ─────────────────────────
create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id), -- null = platform account
  kind public.account_kind not null,
  asset text not null default 'XRP' check (asset in ('XRP', 'USD')),
  normal_side text not null generated always as (
    case when kind in ('omnibus', 'provider_receivable') then 'debit' else 'credit' end
  ) stored,
  created_at timestamptz not null default now(),
  constraint customer_kinds check (
    (customer_id is null and kind in ('omnibus', 'suspense', 'fee_revenue', 'provider_receivable'))
    or (customer_id is not null and kind in ('available', 'reserved', 'pending_yield', 'yield', 'collateral'))
  )
);
create unique index ledger_accounts_unique on public.ledger_accounts (coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, asset);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null, -- e.g. 'withdrawal:requested', 'adjustment', 'reversal'
  reference text not null,
  transaction_id uuid,
  reverses_entry_id uuid references public.journal_entries (id),
  reason text,
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint adjustment_needs_reason check (kind <> 'adjustment' or (reason is not null and length(reason) >= 10))
);

create table public.journal_lines (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.journal_entries (id),
  account_id uuid not null references public.ledger_accounts (id),
  amount_drops bigint not null check (amount_drops <> 0) -- signed: + debit, − credit
);
create index on public.journal_lines (account_id);
create index on public.journal_lines (entry_id);

-- ───────────────────────── Transactions ─────────────────────────
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  customer_id uuid references public.customers (id), -- null while a deposit is unattributed
  kind public.tx_kind not null,
  status text not null,
  amount_drops bigint check (amount_drops is null or amount_drops > 0),
  amount_cents bigint check (amount_cents is null or amount_cents > 0),
  fee_drops bigint not null default 0 check (fee_drops >= 0),
  network_fee_drops bigint not null default 0 check (network_fee_drops >= 0),
  counterparty text,
  destination_tag bigint,
  ledger_hash text,
  ledger_index bigint,
  loan_id uuid,
  idempotency_key text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key)
);
create index on public.transactions (customer_id, created_at desc);
create index on public.transactions (kind, status);
create unique index transactions_ledger_hash on public.transactions (ledger_hash) where ledger_hash is not null;

create table public.transaction_events (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.transactions (id),
  from_status text,
  to_status text not null,
  actor text not null,
  note text,
  at timestamptz not null default now()
);
create index on public.transaction_events (transaction_id, at);

-- Allowed transitions; transition_tx() refuses anything not listed. Mirrors packages/ledger/stateMachines.ts.
create table public.tx_transitions (
  kind public.tx_kind not null,
  from_status text not null,
  to_status text not null,
  primary key (kind, from_status, to_status)
);

-- ───────────────────────── Approvals ─────────────────────────
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions (id),
  required smallint not null check (required in (1, 2)),
  requires_compliance boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid, -- customer or staff who raised it; can never approve it
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.approval_decisions (
  id bigint generated always as identity primary key,
  approval_id uuid not null references public.approvals (id),
  staff_id uuid not null references auth.users (id),
  role public.staff_role not null,
  decision text not null check (decision in ('approve', 'reject')),
  reason text,
  note text,
  at timestamptz not null default now(),
  unique (approval_id, staff_id)
);

-- ───────────────────────── Products ─────────────────────────
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  customer_id uuid not null references public.customers (id),
  principal_usd_cents bigint not null check (principal_usd_cents > 0),
  interest_usd_cents bigint not null default 0 check (interest_usd_cents >= 0),
  repaid_usd_cents bigint not null default 0 check (repaid_usd_cents >= 0),
  apr_bps int not null,
  collateral_drops bigint not null check (collateral_drops >= 0),
  margin_bps int not null default 6500,
  liquidation_bps int not null default 8000,
  origination_fee_cents bigint not null default 0,
  status text not null,
  funded_at timestamptz,
  next_interest_due date,
  provider_ref text,
  created_at timestamptz not null default now()
);

create table public.yield_positions (
  customer_id uuid not null references public.customers (id),
  product text not null default 'xrp_flexible',
  allocated_drops bigint not null default 0 check (allocated_drops >= 0),
  apr_bps int not null,
  fee_bps int not null,
  credited_drops bigint not null default 0,
  confirmed_unpaid_drops bigint not null default 0,
  estimated_accrued_drops bigint not null default 0,
  since timestamptz not null default now(),
  rate_updated_at timestamptz not null default now(),
  primary key (customer_id, product)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id),
  price_micro bigint not null check (price_micro > 0),
  fee_cents bigint not null,
  receive_cents bigint not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.allowlist_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  label text not null,
  address text not null check (address ~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$'),
  tag bigint,
  active_from timestamptz not null default now() + interval '24 hours',
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.external_wallets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  address text not null check (address ~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$'),
  access text not null check (access in ('watch', 'self_custody')),
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Legal, notifications, support ─────────────────────────
create table public.legal_documents (
  id text primary key,
  grp text not null,
  name text not null,
  current_version text not null,
  requires_acceptance boolean not null default true,
  change_summary text,
  sections jsonb not null default '[]'::jsonb,
  sort smallint not null
);

create table public.consents (
  id text primary key, -- CNS-…
  customer_id uuid not null references public.customers (id),
  document text not null references public.legal_documents (id),
  version text not null,
  accepted_at timestamptz not null default now(),
  surface text not null
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  type text not null check (type in ('tx', 'security', 'account')),
  tone text not null default '' check (tone in ('', 'ok', 'warn', 'bad')),
  icon text not null,
  title text not null,
  body text not null,
  link text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (customer_id, created_at desc);

create table public.support_tickets (
  ref text primary key,
  customer_id uuid not null references public.customers (id),
  topic text not null,
  subject text not null,
  transaction_ref text,
  status text not null default 'open' check (status in ('open', 'waiting_on_us', 'waiting_on_you', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_ref text not null references public.support_tickets (ref),
  author text not null check (author in ('customer', 'staff', 'auto')),
  body text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Platform operations ─────────────────────────
create table public.prices (
  asset text not null,
  usd_micro bigint not null check (usd_micro > 0),
  change_bps int not null default 0,
  source text not null,
  at timestamptz not null default now(),
  primary key (asset, at)
);

create table public.idempotency_keys (
  key text not null,
  user_id uuid not null,
  function_name text not null,
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, function_name, key)
);

create table public.provider_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  raw_body text not null,
  signature_valid boolean not null,
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table public.chain_cursor (
  id text primary key default 'omnibus',
  last_ledger_index bigint not null,
  updated_at timestamptz not null default now()
);

create table public.worker_heartbeat (
  worker text primary key,
  validated_ledger bigint,
  nodes_in_sync smallint,
  at timestamptz not null default now()
);

create table public.custody_wallets (
  id text primary key,
  name text not null,
  tier text not null check (tier in ('hot', 'warm', 'cold')),
  address text not null,
  signing text not null,
  ceiling_drops bigint
);

create table public.signers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meta text not null,
  status text not null check (status in ('active', 'standby'))
);

create table public.policy_changes (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  title text not null,
  requested_by uuid not null references auth.users (id),
  requested_role public.staff_role not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references auth.users (id),
  effective_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.limits (
  id text primary key,
  label text not null,
  amount_drops bigint not null
);

create table public.recon_runs (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  validated_ledger bigint not null,
  result jsonb not null, -- per-wallet internal/provider/chain balances
  created_at timestamptz not null default now()
);

create table public.recon_exceptions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.recon_runs (id),
  kind text not null check (kind in ('unbooked_fee', 'deposit_no_tag', 'provider_delay', 'mismatch')),
  title text not null,
  note text not null,
  transaction_id uuid references public.transactions (id),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  status_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.customer_flags (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  note text not null,
  created_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_type public.actor_type not null,
  actor_id text not null,
  actor_name text not null,
  role text,
  action text not null,
  target text not null,
  payload jsonb not null default '{}'::jsonb,
  prev_hash text not null,
  hash text not null
);
create index on public.audit_events (at desc);
