# XRP Ledger Wallet — Technical Design Document

Oct 20, 2026 · @Kamsiyochukwu Brendan Mebuge

## Summary

The mobile app is built with React Native (Expo) in TypeScript. Supabase is the backend: Postgres, Auth, Edge Functions, Storage and Realtime. Postgres holds a double-entry ledger, which is the single source of truth for customer balances. Private keys never touch our systems: a custody provider holds and signs, and a small Node worker watches the XRP Ledger. The admin console is a Next.js web app on the same Supabase project.

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile | Expo SDK (latest stable), React Native, TypeScript, Expo Router | One codebase for iOS and Android; file-based routes match the screen map; EAS for builds and over-the-air updates |
| Server state | TanStack Query | Caching, retries and optimistic UI for balances and activity |
| Local state | Zustand | Small, typed stores for UI state such as theme and hidden amounts |
| Forms and validation | React Hook Form + Zod | One Zod schema shared by the app, the Edge Functions and the admin console |
| Styling | Design tokens in a typed theme + StyleSheet (or Unistyles) | Dark and light themes from one token file, no runtime CSS |
| Charts | react-native-svg + Victory Native | Price and portfolio charts |
| Backend | Supabase (Postgres 15+, Auth with MFA, Edge Functions on Deno, Storage, Realtime, pg\_cron) | Row-level security puts access rules next to the data |
| Chain worker | Node 20 service with xrpl.js on Fly.io or Railway | Needs a long-lived WebSocket to rippled, which Edge Functions can't hold |
| Admin console | Next.js (App Router) on Vercel, Supabase SSR auth | Desktop-first internal tool; shares types and Zod schemas |
| Monorepo | pnpm workspaces + Turborepo | Shared `types`, `schemas`, `tokens` and `ledger` packages |
| Push and email | Expo Notifications; Resend (or Supabase SMTP) | Transaction and security alerts |
| Monitoring | Sentry (app, admin, functions, worker); Supabase logs | Crash and error tracking with release health |

## Architecture

Both apps talk only to Supabase. Postgres is the system of record. The XRPL worker is the only component that talks to the chain, and the custody provider is the only one that signs.

&#91;embedded content: system architecture · clients, Supabase, worker, providers\]

The worker records chain events in Postgres through `transition_tx` and asks the custody provider to sign and submit withdrawals. Provider callbacks enter through HMAC-verified Edge Functions.

## Mobile app

The app is a thin client. It reads through Supabase with the customer's session, so row-level security applies to every read. It writes money movements only by calling Edge Functions, never with direct table inserts.

**Repository layout**

```text
apps/
  mobile/                 Expo app
    app/                  Expo Router routes
      (auth)/             welcome, sign-in, connect-wallet, create-account, verify, identity
      (tabs)/             index (Home), markets, earn, borrow, profile
      notifications.tsx  asset/[symbol].tsx  deposit.tsx  withdraw/  exchange/
      loan/manage.tsx  custody.tsx  security.tsx  support.tsx  legal/
    src/components/       Button, Card, Row, Sheet, Status, Timeline, Toast, …
    src/features/         one folder per area: hooks, queries, screens
    src/lib/              supabase client, query client, secure storage, analytics
  admin/                  Next.js admin console
services/
  xrpl-worker/            Node + xrpl.js listener and submitter
supabase/
  migrations/  functions/  seed.sql  tests/
packages/
  tokens/  schemas/  types/  ledger/
```

**Navigation:** Expo Router with an `(auth)` group and a `(tabs)` group. A root layout redirects on session and verification status: no session goes to Welcome; a session that isn't verified goes to Verify. Sheets use `@gorhom/bottom-sheet`.

**Data:** TanStack Query keys per entity (`['balances']`, `['activity', filter]`, `['loan', id]`). Supabase Realtime subscriptions on the customer's transactions and notifications invalidate those keys, so statuses update live.

**Theming:** `packages/tokens` exports the dark and light token sets from the Design Document. A `ThemeProvider` picks Dark, Light or System (`useColorScheme`) and persists the choice in AsyncStorage.

**Device security**

- The session is stored in `expo-secure-store` (Keychain / Keystore), never AsyncStorage.
- App lock with `expo-local-authentication` (Face ID / fingerprint) on launch and before withdrawals.
- A screenshot blocker and a blurred app-switcher preview on Deposit, Security and the recovery-phrase screen.
- Recovery-phrase import runs fully on-device with xrpl.js. Words live only in component state, are never logged, sent or persisted, and are cleared on unmount.
- Certificate pinning for the Supabase domain, plus jailbreak / root detection as a warning only.

## Supabase backend

Supabase holds identity, data, business rules and files. Postgres enforces the money rules itself, so a bug in a client or a function cannot create or lose XRP.

**Auth**

- Email + password sign-up with email OTP confirmation, plus Supabase MFA (TOTP) for 2FA. Backup codes are stored as bcrypt hashes in `auth_backup_codes`.
- Sessions are short-lived JWTs with refresh. Sensitive functions (withdraw, change password, disable 2FA, add allowlist address) require the `aal2` assurance level.
- Staff sign in to the admin console with SSO or email + TOTP. Staff roles live in `staff_roles` and are added to the JWT by a custom access-token hook as `app_role`.

**Row-level security**

- Every table has RLS on. Customers can `select` only rows where `customer_id = auth.uid()`; they have no `insert`, `update` or `delete` on money tables.
- Staff policies check `auth.jwt() ->> 'app_role'`. Personal data is served to staff through a `customers_masked` view that masks by role. Only Compliance can select the base table.
- Ledger and audit tables are insert-only for the `service_role`, and an update or delete raises an error in a trigger.

**Edge Functions (Deno, TypeScript)**

| Function | Caller | Does |
| --- | --- | --- |
| `deposit-address` | App | Returns the shared address + the customer's destination tag |
| `withdraw-request` | App (aal2) | Validates with Zod, checks limits and allowlist, reserves funds in one SQL transaction, creates an approval |
| `exchange-request` / `exchange-accept` | App | Records the request; accepts a firm quote and reserves XRP |
| `yield-allocate` / `yield-redeem` | App | Moves XRP to or from pending yield via the provider adapter |
| `loan-repay` / `loan-add-collateral` | App | Creates repayment or collateral requests |
| `kyc-session` / `kyc-webhook` | App / KYC provider | Starts verification; applies the provider's verified webhook |
| `approval-decide` | Admin | Approve or reject with separation-of-duties checks |
| `recon-run` | pg\_cron / Admin | Compares ledger, custody and chain balances; writes exceptions |
| `provider-webhook-*` | Providers | HMAC-verified callbacks that advance transaction states |

Every function that moves money accepts an `Idempotency-Key` header. Keys are stored in `idempotency_keys`, so retries never double-post.

**Storage:** a private `kyc` bucket holds ID images and proof of address, uploaded with signed URLs and readable only by Compliance. A `statements` bucket holds generated PDFs.

**Realtime:** channels on `transactions` and `notifications`, filtered by `customer_id` under RLS.

**pg\_cron:** daily reconciliation at 00:00 WAT, yield accrual estimates hourly, loan LTV checks every 5 minutes (from the market price table), and expiry of stale quotes.

## Data model

Balances are never stored as editable numbers. They are sums of immutable journal lines, and each journal entry must balance to zero.

| Table | Key columns | Notes |
| --- | --- | --- |
| `customers` | id (= auth uid), full\_name, email, phone, dob, country, kyc\_status, risk\_rating, frozen\_at | Personal data; staff read it through `customers_masked` |
| `kyc_checks` | id, customer\_id, provider\_ref, status, documents\[\], decided\_at | Mirrors provider state |
| `ledger_accounts` | id, owner (customer\_id or `platform`), kind, asset | Kinds: available, reserved, pending\_yield, yield, collateral, omnibus, suspense, fee\_revenue, provider\_receivable |
| `journal_entries` | id, created\_at, kind, reference, created\_by | One per money event |
| `journal_lines` | entry\_id, account\_id, amount\_drops (bigint, signed) | XRP in drops (1 XRP = 1,000,000 drops); no floats anywhere |
| `transactions` | id, customer\_id, kind, status, amount\_drops, destination, tag, ledger\_hash, ledger\_index, idempotency\_key | The customer-facing record; statuses per state machine |
| `transaction_events` | transaction\_id, from\_status, to\_status, actor, at, note | Timeline shown in app and admin |
| `approvals` | id, transaction\_id, required, decisions\[\] (staff\_id, role, decision, reason, at) | Separation of duties enforced in SQL |
| `allowlist_addresses` | customer\_id, label, address, tag, active\_from | 24-hour activation |
| `loans` | id, customer\_id, principal\_usd\_cents, apr\_bps, collateral\_drops, margin\_bps 6500, liquidation\_bps 8000, status | Interest accrued daily into journal |
| `yield_positions` | customer\_id, product, allocated\_drops, apr\_bps, fee\_bps | Provider-confirmed only |
| `quotes` | id, transaction\_id, rate, expires\_at, accepted\_at | Firm exchange quotes |
| `consents` | customer\_id, document, version, accepted\_at, surface | Legal acceptance records |
| `notifications` | customer\_id, type, title, body, link, read\_at | Feeds the bell and push |
| `support_tickets` / `ticket_messages` | ref, customer\_id, topic, transaction\_id, status | In-app support |
| `audit_events` | id, at, actor\_type, actor\_id, role, action, target, payload, prev\_hash, hash | Hash chain over each row |
| `prices` | asset, usd, source, at | Market data cache |

**Ledger invariants (enforced in Postgres)**

1. A deferred constraint trigger rejects any `journal_entry` whose lines don't sum to 0.
2. A customer's available balance can't go below 0. The check runs inside the same transaction that posts the lines, using `select … for update` on the account.
3. Posted lines are immutable. Corrections are compensating entries that reference the original.
4. Each `audit_events.hash` = SHA-256 of (prev\_hash + canonical row). A nightly job re-verifies the chain.
5. Balances are exposed by a `balances` view (sum of lines per account), with a materialised snapshot for the admin dashboards.

Money is stored as bigint drops for XRP and integer cents for USD. Formatting happens only in the UI.

## Money flows

Each transaction kind is a state machine. Transitions are allowed only by a Postgres function (`transition_tx`), which writes the event, posts the journal entry for that step and emits a notification, all in one database transaction.

| Kind | States (happy path) | Journal at each step | Off-path states |
| --- | --- | --- | --- |
| Deposit | detected → validated → screened → credited | credited: Dr omnibus / Cr customer available | no\_tag → suspense (Dr omnibus / Cr suspense), later attributed; screening\_hold |
| Withdrawal | requested → in\_review → approved → submitted → validated (completed) | requested: Dr available / Cr reserved. validated: Dr reserved / Cr omnibus + fee\_revenue | rejected or failed: reversal Dr reserved / Cr available |
| Exchange | requested → quote\_requested → quoted → accepted → sold → paid\_out | accepted: available → reserved. sold: reserved → omnibus. Payout tracked in USD cents | rejected (nothing reserved); quote\_expired |
| Yield allocate | requested → sent → confirmed | requested: available → pending\_yield. confirmed: pending\_yield → yield | provider\_failed: reversal |
| Yield reward | statement\_received → matched → credited | Dr provider\_receivable / Cr available + fee\_revenue | mismatch → recon exception |
| Loan | applied → approved → collateral\_locked → funded → active → repaid | collateral\_locked: available → collateral. repaid: collateral → available | margin\_call (LTV ≥ 65%), liquidating (LTV ≥ 80%) |

**Rules that apply to every flow**

- "Completed" for a withdrawal means a validated ledger result (`tesSUCCESS` in a validated ledger), never just "submitted".
- Approvals: up to 1,000 XRP needs 1 staff approval; over 1,000 XRP needs 2 from different staff, one of them Compliance. `approval-decide` checks the role in SQL.
- Quotes expire after their `expires_at`; accepting an expired quote fails with a clear error.
- LTV monitor: a cron job recomputes LTV from `prices`. Crossing 55% sends an alert, 65% starts a margin call, and 80% flags the loan for the lending provider to liquidate. It never auto-sells on our side.

## Integrations

Every external service sits behind a TypeScript interface in `packages/providers`, with a mock used in development, so a provider can be swapped without touching flows.

**XRPL worker (`services/xrpl-worker`)**

- Connects with xrpl.js over WebSocket to two rippled endpoints (one self-hosted or paid, one public as a fallback).
- Subscribes to the omnibus deposit addresses (`subscribe` accounts stream). It acts only on transactions in a validated ledger, with `TransactionResult = tesSUCCESS` and a positive `delivered_amount`.
- It maps the `DestinationTag` to a customer and calls `transition_tx`; a missing or unknown tag goes to suspense.
- On restart it replays from the last processed `ledger_index`, which is stored in `chain_cursor`, so no deposit is missed.
- For withdrawals, it picks up `approved` transactions, asks the custody provider to sign and submit, then waits for validation. Transactions use `LastLedgerSequence` so a failed one expires cleanly instead of hanging.
- It writes a heartbeat row every 30 s; the admin Overview shows node lag and alerts if the heartbeat stops.

**Provider adapters**

| Interface | Methods | Placeholder |
| --- | --- | --- |
| `CustodyProvider` | getBalances, requestWithdrawal, getTransfer, listWallets | \[Custody provider\] |
| `KycProvider` | createSession, getResult, webhook verify | \[KYC provider\] |
| `ScreeningProvider` | screenAddress, screenTransfer | \[Screening provider\] |
| `LiquidityProvider` | requestQuote, executeQuote | \[Liquidity provider\] |
| `PayoutProvider` | createPayout, getPayout | \[Bank / payout provider\] |
| `YieldProvider` | allocate, redeem, getStatement | \[Yield provider\] |
| `LendingProvider` | apply, fund, getLoan, liquidate | \[Lending provider\] |
| `PriceFeed` | getPrice, getHistory | \[Market data provider\] |

Webhooks are verified with HMAC and checked against a replay window. Each provider callback is stored raw in `provider_events` before it is processed, so it can be replayed.

## Admin console

The admin console is a Next.js App Router app on Vercel. Its Server Components read through `@supabase/ssr` with the staff member's session, so the same RLS policies apply to staff.

- **Access:** separate staff accounts with TOTP required; an IP allowlist via Vercel Firewall; idle sessions expire after 15 minutes.
- **Roles:** `operations`, `compliance`, `auditor` in `staff_roles`. The UI hides or disables actions, but every rule is enforced again in SQL or the Edge Function.
- **Writes:** Server Actions call Edge Functions (`approval-decide`, `recon-run`, `customer-freeze`, `policy-decide`). They never write tables directly.
- **Separation of duties:** `approval-decide` refuses a decision from the requester, from the same person twice, or from the same role for the second approval when a Compliance approval is required.
- **Reconciliation view:** reads `recon_runs` and `recon_exceptions`. Fee adjustments post a journal entry of kind `adjustment`, which needs a reason.
- **Users view:** reads `customers_masked`. Compliance can open the full record, and that read is itself written to `audit_events`.
- **Audit log:** paginated from `audit_events`, with chain status from the nightly verification. Exports are generated server-side and logged.
- **UI:** shadcn/ui + Tailwind, with tokens from `packages/tokens`; TanStack Table for queues and lists.

## Security and compliance

The design limits the blast radius: there are no private keys in our systems, there is no direct client write to money tables, and every privileged action needs a second person or leaves a tamper-evident trail.

| Area | Control |
| --- | --- |
| Keys | Signing only inside the custody provider's MPC/HSM; our worker holds an API credential scoped to request withdrawals that the provider's own policy also checks |
| Secrets | Supabase Vault for function secrets; Fly/Railway and Vercel encrypted env vars; no secrets in the app bundle beyond the anon key |
| Service role | Used only by Edge Functions and the worker, never shipped to clients or the admin browser |
| Account takeover | MFA (aal2) on money actions; 24-hour holds after password change, 2FA off and new allowlist address; new-device alerts; rate limits on auth and OTP |
| Data protection | TLS everywhere; Postgres encryption at rest; KYC files in a private bucket with signed URLs (60 s); personal data masked per staff role |
| Integrity | Balanced-entry trigger, immutable journal, hash-chained audit log, daily three-way reconciliation |
| Abuse | Withdrawal velocity limits, screening of every destination, freeze flag checked by every money function |
| Privacy | Data retention policy per jurisdiction; customer data export and deletion flows (except records the law requires us to keep) |
| Reviews | Threat model before launch; external penetration test; dependency scanning (Dependabot) and secret scanning in CI |

Compliance obligations (licensing, travel rule, reporting) depend on the operating company and jurisdictions, which are still open. The schema keeps the fields they need (originator and beneficiary data on transfers) so they can be switched on without a migration.

## Environments, testing and delivery

There are three environments. Each has its own Supabase project, and none shares keys with another.

| Environment | Supabase | XRPL network | Providers | App distribution |
| --- | --- | --- | --- | --- |
| Local | Supabase CLI (Docker) | XRPL testnet | Mocks | Expo Go / dev client |
| Staging | Staging project | Testnet | Provider sandboxes | EAS internal + TestFlight |
| Production | Production project (Pro plan, PITR backups) | Mainnet | Live | App Store / Play Store |

**Testing**

- Database: pgTAP tests for the RLS policies, the balanced-entry trigger, `transition_tx` for every allowed and forbidden transition, and the separation-of-duties checks.
- Functions and worker: Vitest unit tests; integration tests against local Supabase and testnet with mocked providers.
- App: Jest + React Native Testing Library for components; Maestro end-to-end flows (sign up, deposit, withdraw, repay) on iOS and Android.
- Admin: Playwright for the queue, reconciliation and role restrictions.
- Ledger property tests: random sequences of flows must keep total liabilities equal to total holdings.

**CI/CD (GitHub Actions + Turborepo)**

- Every PR runs typecheck, lint, unit tests, pgTAP, and a migration dry-run against a Supabase branch.
- Merging to `main` deploys to staging: migrations via `supabase db push`, functions via `supabase functions deploy`, the worker to Fly/Railway, admin to Vercel preview, and an EAS build.
- Production is a tagged release with a manual approval. App JS-only fixes ship via EAS Update; native changes ship via store review.

**Observability:** Sentry everywhere; structured JSON logs; alerts for worker heartbeat lost, recon exception opened, a withdrawal stuck in a state for more than 2 hours, and provider error rate above 5%.

## Delivery plan

Build in five phases, each ending in something testable on testnet, so the riskiest part (the ledger and the chain worker) is proven first.

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| 1. Foundations | Monorepo, tokens, component library, Supabase schema, ledger triggers, RLS, auth + MFA | pgTAP green; sign up, sign in and 2FA work in the app |
| 2. Deposit and withdraw | XRPL worker, deposit address and tags, withdrawal flow, approval queue, mock custody | Testnet deposit credited end to end; withdrawal approved and validated on testnet |
| 3. Admin and reconciliation | Transactions, reconciliation, users with masking, audit log, custody view | Daily recon runs clean; role rules pass Playwright |
| 4. Products | Exchange, Earn, Borrow, Manage loan behind provider adapters | Each flow passes Maestro with sandbox providers |
| 5. Hardening | KYC live, notifications, legal consents, light-mode pass, accessibility, pen test | Release checklist in the UI/UX spec passes; pen-test findings fixed |

**Open questions**

- [ ] Which custody provider? This decides the signing API and the wallet structure (one omnibus address vs per-customer addresses).
- [ ] Self-hosted rippled, or a paid node provider?
- [ ] Payout currencies and banking partner (USD only, or NGN too)?
- [ ] Operating jurisdictions, which set the KYC tiers, limits and travel-rule handling.
- [ ] Worker host: Fly.io or Railway?
