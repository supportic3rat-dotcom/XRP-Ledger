# Testing

| Suite | Command | Covers |
| --- | --- | --- |
| Ledger maths | `pnpm --filter @xrp/ledger test` | Half-up rounding, parsing, LTV, journal sets balance |
| Schemas | `pnpm --filter @xrp/schemas test` | Integer drops only, tag range, addresses, security actions, OTP formats |
| Providers | `pnpm --filter @xrp/providers test` | Placeholder names, bigint amounts, quotes, deterministic series |
| Database | `pnpm --filter @xrp/supabase test` (PGlite, no Docker) | Balanced entries, immutability, RLS, separation of duties, money RPCs, idempotency, holds, backup codes, reconciliation, worker writes, audit chain |
| Edge Functions | same command (Deno) | Auth and aal2, Zod validation, idempotent replay, error mapping, webhook HMAC and replay window, custody can't mark Completed |
| XRPL worker | `pnpm --filter @xrp/xrpl-worker test` | Deposit classification (validated, tesSUCCESS, delivered_amount), cursor replay, withdrawal settlement and expiry |
| XRPL live | `pnpm --filter @xrp/xrpl-worker smoke` | Real testnet: tagged deposit detected, withdrawal validated, retry not double-sent |
| Mobile | `pnpm --filter @xrp/mobile test` (Jest + RNTL) | Components, sign-in flow, demo API money rules and idempotency |
| Mobile devices | `maestro test apps/mobile/.maestro` | Sign in, deposit, withdraw — **written but not yet run** (no simulator was available) |
| Admin | `pnpm --filter @xrp/admin test` / `e2e` (Playwright) | Approval rules, masking, formatting; approve/reject/freeze/fee adjustment/auditor read-only/collapsed layout |
| Web | `pnpm --filter @xrp/web test` / `e2e` | Integer money; send validation and submission, receive, routes, periods, collapsed layout |
| Contrast | `node tools/contrast.mjs` | WCAG AA for every text token on its surfaces |

## Visual verification

The apps are compared with the design references at exact viewport sizes:

- Mobile (390×844, dark and light): `tools/visual/verify-all.sh` with Expo web on :8081.
- Admin (1440 and 700): `OUT=… tools/visual/verify-admin.sh` with the console on :3100.
- Web (1440 and 700): `node tools/visual/dc-serve.mjs` (renders `Main.dc.html`, which has no screens-html), then
  `node tools/visual/dash-states.mjs <out>` with the dashboard on :3300.

Remaining differences are listed in `docs/deviations.md`.
