# XRP Ledger custodial wallet

A custodial XRP Ledger wallet: an Expo mobile app, a desktop web dashboard, a staff admin console, a Supabase backend
with a double-entry ledger, and an XRPL worker. Built from the design in `reference/` (screens-html for appearance,
`.dc.html` for behaviour, the TDD for architecture).

## Layout

| Path | What it is |
| --- | --- |
| `apps/mobile` | Expo (React Native) customer app: 21 screens, demo or Supabase backend |
| `apps/web` | Next.js customer dashboard (desktop design, `Main.dc.html`) |
| `apps/admin` | Next.js staff console: Overview, Approval queue, Transactions, Reconciliation, Users, Custody, Audit log |
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
pnpm web             # customer dashboard  → http://localhost:3300
pnpm admin           # staff console       → http://localhost:3100
```

Without Supabase settings every app runs in **demo mode** on the design's sample data:

- Mobile: sign in with any email and an 8+ character password (one containing "wrong" fails); any 6-digit code passes 2FA.
- Admin: choose a sample role (Operations, Compliance, Auditor) on the sign-in page.
- Web: opens straight to the sample account.

### Connecting Supabase

1. Create a project, then apply `supabase/migrations` and `supabase/seed.sql` (`supabase db push`, `psql`, or the dashboard).
2. Enable TOTP MFA and register `public.custom_access_token_hook` as the access-token hook (see `supabase/config.toml`).
3. Deploy the Edge Functions: `supabase functions deploy` (import map: `supabase/functions/deno.json`).
4. Set function secrets: `CRON_SECRET`, `ALLOWED_ORIGINS`, `XRPL_NETWORK`, `WEBHOOK_SECRET_<PROVIDER>`.
5. Fill `.env` from `.env.example` (public URL and anon key for the apps; service role key only for the worker).
6. Scheduled jobs run in the XRPL worker, not pg_cron: give the worker the same `CRON_SECRET` as the Edge Functions so it can start the daily `recon-run`.

Seeded test users (password in brackets) — staff must enrol an authenticator before using the console:

| Who | Email | Role |
| --- | --- | --- |
| Brendan (mobile sample customer) | brendan@example.com (Prototype-Pass-2026) | customer |
| Tobi (admin sample customer, CUS-0042) | tobi.adeyemi@example.com (Customer-Pass-2026) | customer |
| A. Bello, M. Okon | a.bello@ops.example.com (Ops-Pass-2026), m.okon@ops.example.com | operations |
| J. Duru, K. Musa | j.duru@ops.example.com (Compliance-Pass-2026), k.musa@ops.example.com | compliance |
| Auditor | auditor@ops.example.com (Auditor-Pass-2026) | auditor |

These are test credentials for local and staging projects only; change or remove them before production.

### XRPL worker (testnet)

```sh
pnpm --filter @xrp/xrpl-worker testnet:wallet   # funds a testnet hot wallet; prints the seed and SQL
pnpm --filter @xrp/xrpl-worker smoke            # live testnet check: deposit detection + signed withdrawal
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… TESTNET_HOT_WALLET_SEED=… pnpm --filter @xrp/xrpl-worker start
```

On mainnet the worker refuses a local seed; signing happens only at the custody provider.

## Tests

`pnpm typecheck` and `pnpm test` run everything; see `docs/testing.md` for what each suite covers and for the
end-to-end and visual checks.
