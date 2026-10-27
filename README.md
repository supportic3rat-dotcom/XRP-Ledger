# XRP Ledger custodial wallet

A custodial XRP Ledger wallet: one Expo mobile app (customer wallet and staff operations console), a Supabase backend
with a double-entry ledger, and an XRPL worker. Built from the design in `reference/` (screens-html for appearance,
`.dc.html` for behaviour, the TDD for architecture).

## Layout

| Path | What it is |
| --- | --- |
| `apps/mobile` | Expo (React Native) app. Customers get the wallet; staff signing in get the operations console (`app/ops`: Overview, Approval queue, Transactions, Users, Reconciliation, Assets, Custody, Audit log) |
| `old/web`, `old/admin` | Retired Next.js customer dashboard and staff console, kept for reference. Not in the workspace, not built or tested |
| `services/xrpl-worker` | Node worker: validated-only deposits, withdrawal submission and confirmation, heartbeat, balances, prices |
| `supabase` | Migrations (schema, ledger rules, RLS, audit chain, money RPCs), seed, Edge Functions (Deno), tests |
| `packages/tokens` | Colours, fonts, icons — the single source for every app |
| `packages/ledger` | Integer money maths, fees, state machines, journal rules (mirrors SQL) |
| `packages/schemas` | Zod schemas and validation copy, shared by apps and Edge Functions |
| `packages/providers` | Provider interfaces (`[Custody provider]`, `[KYC provider]`, …) and mocks |
| `packages/types` | Domain types |
| `tools/visual` | Pixel/text comparison against the design references |
| `docs/` | `deviations.md` (every intentional difference and open question), `testing.md` |

## Money rules

- XRP is stored as `bigint` drops and USD as integer cents. No floats anywhere money is stored or posted.
- Clients never write money tables. Every money action goes through an Edge Function → an SQL function that validates,
  posts a balanced journal entry and moves the state machine (`transition_tx`) in one transaction.
- A withdrawal is "Completed" only after the XRPL worker sees `tesSUCCESS` in a validated ledger.
- Money functions take an `Idempotency-Key`; retries replay the first response and never post twice.

## Running locally

Requires Node 20+ and pnpm. Docker isn't needed for development or tests.

```sh
pnpm install
pnpm mobile          # Expo; press w for web, or run on a device
```

Without Supabase settings the app runs in **demo mode** on the design's sample data: sign in with any email and an
8+ character password (one containing "wrong" fails). `support.xrp@gmail.com` opens the console as Operations and
`support.xrp+compliance@gmail.com` as Compliance; any other email opens the customer wallet.

### Staff accounts

Staff use the same sign-in screen as customers. After the password check the app reads `app_role` from the access
token (added by `public.custom_access_token_hook` for anyone in `staff_roles`) and opens the console instead of the
wallet. Create the two staff sign-ins once with `supabase/staff-accounts.local.sql` in the SQL editor (the file holds
the passwords, is git-ignored, and should be deleted after it runs). Staff change their password in More → Change
password; customers in Profile → Security settings.

### Connecting Supabase

1. Create a project, then apply `supabase/migrations` and `supabase/seed.sql` (`supabase db push`, `psql`, or the dashboard).
2. Register `public.custom_access_token_hook` as the access-token hook (Authentication → Hooks; see `supabase/config.toml`). Without it staff sign in to the customer wallet instead of the console.
3. Deploy the Edge Functions: `supabase functions deploy` (import map: `supabase/functions/deno.json`).
4. Set function secrets: `CRON_SECRET`, `ALLOWED_ORIGINS`, `XRPL_NETWORK`, `WEBHOOK_SECRET_<PROVIDER>`.
5. Fill `.env` from `.env.example` (public URL and anon key for the apps; service role key only for the worker).
6. Scheduled jobs need no server and no pg_cron: the app calls the `upkeep` Edge Function while it's open, and it runs whatever is due (prices every 5 minutes, quote expiry, loan checks, ledger balances, the daily reconciliation and audit check after 23:00 UTC).

Seeded test users (password in brackets):

| Who | Email | Role |
| --- | --- | --- |
| Brendan (mobile sample customer) | brendan@example.com (Prototype-Pass-2026) | customer |
| Tobi (admin sample customer, CUS-0042) | tobi.adeyemi@example.com (Customer-Pass-2026) | customer |
| A. Bello, M. Okon | a.bello@ops.example.com (Ops-Pass-2026), m.okon@ops.example.com | operations |
| J. Duru, K. Musa | j.duru@ops.example.com (Compliance-Pass-2026), k.musa@ops.example.com | compliance |
| Auditor | auditor@ops.example.com (Auditor-Pass-2026) | auditor |

These are test credentials for local and staging projects only; change or remove them before production.

### XRPL worker

Not needed while XRP is staff-confirmed (`assets.deposit_mode = 'reported'`): prices, balances and scheduled jobs run in
the `upkeep` Edge Function. The worker is only for the automatic XRP path (crediting tagged deposits and sending
withdrawals itself), which needs an always-on server. It runs on **mainnet** (`XRPL_NETWORK=mainnet`, the default).

```sh
pnpm --filter @xrp/xrpl-worker start   # reads services/xrpl-worker/.env
```

For development only, `XRPL_NETWORK=testnet` switches to the XRPL testnet: `testnet:wallet` funds a test hot wallet and
`smoke` checks deposit detection and a signed withdrawal there. On mainnet the worker refuses a local seed; signing
happens only at the custody provider.

## Tests

`pnpm typecheck` and `pnpm test` run everything; see `docs/testing.md` for what each suite covers and for the
end-to-end and visual checks.
