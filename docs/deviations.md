# Deviations from the design and open items

Everything here differs from the design files or the brief on purpose, or still needs a decision.

## Visual / copy

| Where | What differs | Why |
| --- | --- | --- |
| All mobile screens | Top padding includes the device safe-area inset | The design is drawn without a status bar; on device content would sit under it |
| Home, Asset detail | Activity sorted by time | The design's sample list isn't in time order (decision 5: improvements allowed) |
| Home | Eye icon to hide amounts | Added (decision 5) |
| Profile | Theme segment includes System; Currency row; sign-out confirmation | Decisions 4 and 6 |
| Deposit | Real QR code; Testnet badge | Decision 17; network is testnet |
| Welcome / onboarding | Prototype-only copy removed ("Meanwhile you can · Explore the app" kept as a link) | Decision 12 |
| Security · Backup codes | Codes are shown only right after they're generated; afterwards the sheet shows masked placeholders | Codes are stored as bcrypt hashes (TDD), so they can't be shown again |
| Security · Two-factor | New "Set up your authenticator" sheet (QR, key, 6-digit code) when turning 2FA on with no authenticator | The design has no enrolment screen; Supabase TOTP needs one. Built from existing components. **Needs design review.** |
| Asset detail | Tapping a row opens the same transaction sheet as Home | Consistency |
| Security · Allowlist | Seeded Off | Profile and Security in the design disagree (On vs Off) |
| "≈" glyph | ~1.5 px narrower | Expo's Geist TTF vs Google Fonts' Geist; accepted |

## Admin console

| Where | What differs | Why |
| --- | --- | --- |
| Sign-in | New staff sign-in page (email, password, authenticator code); in demo mode it offers the three sample roles | The design has none; staff need TOTP (aal2) |
| Sidebar "You" card | Opens a small menu with "Sign out" | Sign-out has to live somewhere; the card looks the same until clicked |
| Approval queue | Decided items stay listed for an hour so the outcome banner is visible, then drop off | The prototype keeps them for the session |
| Live mode copy | Provider-health notes, timeline wording and summaries come from real data, so they read slightly differently from the sample text | Sample text is literal in the prototype |
| Audit hashes | Demo shows the prototype's display hash; live mode shows the first 8 hex of the SHA-256 chain hash | Real chain |
| Fee adjustment | Booked with a standard reason ("Book network fees found by reconciliation") | The TDD requires a reason; the design has no input for one |

## Desktop dashboard (apps/web, from Main.dc.html)

| Where | What differs | Why |
| --- | --- | --- |
| Whole dashboard | The design shows BTC and ETH balances, Solana/Litecoin prices and card purchases. Demo mode keeps that sample data; live mode shows the account's real holdings, which are XRP only | The TDD, ledger schema, custody and providers are XRP-only. **Open question: should the web dashboard show multiple assets?** |
| Header pill, footer, Receive/Send notes | "Prototype · fictional data" and other prototype notes are replaced: demo mode says "Demo · sample data"; live mode shows none | Decision 12 |
| Buy crypto | Hidden in live mode; in demo it opens the design's dialog and places no order | No payment provider is in the TDD. **Open question** |
| Send (live) | Fees come out of the amount ("Recipient receives 99.749988 XRP"), and the review step asks for the authenticator code | Matches the mobile app and the TDD (aal2 + TOTP on withdrawals) |
| Receive (live) | Real QR code and deposit address | Decision 17 |
| Settings · Two-factor on (live) | Points to the mobile app for authenticator setup; turning it off starts the 24-hour hold | Enrolment UI lives in the mobile app |
| Message support (live) | Points to Help & Support in the mobile app | No web ticket form in the design |
| Earn | Copy says XRP Flexible yield is in the mobile app | The design's copy said no programs exist, which isn't true of the product |
| Sign-in | New web sign-in page (email, password, authenticator code) built from the dashboard's styles | The design has none |
| Transaction detail | "Ledger record" shows the ledger index, or "Not on a ledger yet" | Real data |

## Behaviour

| Area | Behaviour | Source |
| --- | --- | --- |
| Withdrawals | "Completed" only when the XRPL worker sees `tesSUCCESS` in a validated ledger; custody callbacks can only move a withdrawal to submitted/failed | Brief rule; TDD |
| 2FA off | Takes effect after 24 hours (cancellable by turning it back on); withdrawals pause for those 24 hours; with 2FA off, withdrawals stay unavailable because they need an authenticator code | Security screen copy; TDD account-takeover controls |
| Password change | Other devices are signed out (sessions deleted) and withdrawals pause for 24 hours | Design Document; TDD |
| New device | Its first sign-in pauses withdrawals from it for 24 hours (except the customer's first device) and sends a security notification | TDD "new-device alerts" |
| Backup-code sign-in | Marks that session; the access-token hook issues `aal2` for it on refresh | Supabase MFA has no native backup codes |
| Staff | Staff roles only count on an `aal2` (TOTP) session, enforced in SQL | TDD: staff TOTP required |
| Signed-out support | Messages land in `public_contact_requests`, rate-limited to 3 per email per hour | Support is reachable signed out |
| Exchange | Operations reviews the request before the liquidity provider quotes it | Prototype behaviour (.dc.html) |

## Still to verify

- Native iOS/Android run (Xcode was unavailable; verified on Expo web at 390×844 against screens-html).
- A live Supabase project (functions and migrations are tested locally with PGlite and Deno; not yet deployed).
- Real provider adapters (all providers are mocks behind `packages/providers` interfaces).

## Brand mark (logo.jpg)

- The design's brand mark (three bars on a rounded tile) is replaced everywhere by the supplied logo: a wallet with the XRP mark and a coin on the clasp. It is traced to vectors in `packages/tokens/src/brand.ts`; the tile keeps each app's colours (accent on mobile and web, sidebar colours on admin).
- At 32 px and below the glyph uses a bolder weight so the coin and the X stay legible.
- App icon, Android adaptive icon, splash image and favicons are generated from the same geometry by `tools/visual/brand-icons.mjs`; rerun it after changing the logo.

## 2026-10-22 additions

- **Earn · live accrual.** The position card shows a per-second estimate of rewards accruing, net projections at 10/30/90/365 days, and a 12-month growth chart (`LiveAccrual.tsx`). Estimates only; credited rewards still come from provider confirmation.
- **Terms of Service.** Full 20-section draft replaces the outline (demo seed + `supabase/seed.sql`). Bracketed placeholders remain for company details; still needs legal review.
- **Admin · customer detail.** Adds "Devices and sign-ins" and "Recent activity". Staff can now read `devices` and `security_events` (migration `20261022000100`). Device location adds the edge-observed country (`cf-ipcountry`) to the client's city hint.
- **Connect wallet · source picker.** Recovery-phrase import asks which wallet the phrase is from (Trust Wallet, Exodus, Ledger, Atomic, Xaman, other) and shows where to find it. Xaman (Secret Numbers) is blocked from phrase import. The phrase still never leaves the device.
- **Not built, by design:** sending or showing customers' recovery phrases to staff.

## 2026-10-22 · Multi-asset (all coins), real logos, live market data

- **18 supported assets:** XRP, BTC, ETH, USDT (TRC-20), USDC (ERC-20), SOL, BNB (BEP-20), ADA, DOGE, TRX, LTC, AVAX, DOT, LINK, XLM, TON, BCH, POL. Registry in `packages/ledger/src/assets.ts`, mirrored by `public.assets` (migration `20261022000200_multi_asset.sql`). More coins = one registry entry + one row.
- **Ledger:** amounts are base units at each asset's ledger precision (max 8 decimals so balances fit bigint; ETH/SOL etc. are stored at 8, not native 18/9). Column names keep `*_drops`. Journal entries must balance per asset.
- **Deposits:** XRP stays automatic (tag + worker). Other assets are *reported*: customer sends to the address Compliance sets in Admin → Assets, reports the hash; a second staff member confirms on the network and approves the credit. Staff can also record a deposit for a customer (needs a different approver).
- **Withdrawals:** per-network address validation, tag (XRP) or memo (XLM, TON), per-asset fees/limits/two-approval threshold. Non-XRP withdrawals are sent by staff after approval and marked sent (hash) or failed (refund) in Admin → Transactions. The XRPL worker only touches XRP.
- **Exchange:** sell any asset for USD, or swap into another asset (credited on `paid_out`).
- **Earn / Borrow:** a Flexible product per asset (sample APRs), each position with live accrual; any asset flagged `collateral` can secure a loan, LTV priced in that asset. Loans now get a `loans` row when activated (previously only seeded).
- **Live data:** CoinGecko (prices, 24h/7d change, sparklines, market stats, chart history) in mobile, web and admin; the worker records every asset's price every minute (`MARKET_DATA=mock` to disable). Optional `COINGECKO_API_KEY` / `EXPO_PUBLIC_COINGECKO_API_KEY` / `NEXT_PUBLIC_COINGECKO_API_KEY` raise the rate limit — **recommended for production**; the free tier rate-limits (portfolio charts fetch only the 3 largest holdings for that reason). Falls back to labelled sample prices when unreachable.
- **Logos:** web3icons (MIT) for 17 coins, cryptocurrency-icons (CC0) for DOGE, in `packages/tokens/src/coins.ts`.
- **Not done:** XRPL-only connected/self-custody wallets (phrase import derives an XRP account); no automatic on-chain monitoring for non-XRP deposits (staff confirm them); no `deposit-report` from the web dashboard (it points to the app).

## 2026-10-23 · Scheduled jobs moved from pg_cron to the XRPL worker

- The project runs on a Supabase plan where we don't use pg_cron. The migrations no longer call `cron.schedule`;
  `public.run_job(text)` (service role only) runs each job, and `services/xrpl-worker/src/jobs.ts` calls it on timers:
  quote expiry every minute, LTV check and pending 2FA removals every 5 minutes, balances snapshot every 10, yield
  estimate hourly, audit-chain verification daily at 23:30 UTC. Daily reconciliation (23:00 UTC, 00:00 WAT) is a POST
  to `recon-run` with `x-cron-secret`, so the worker needs `CRON_SECRET`; without it recon is skipped and logged.
- The job functions (`ltv_check`, `expire_quotes`, `estimate_yield_accrual`, `run_audit_verification`) are no
  longer executable by `anon`/`authenticated`; previously they had Postgres' default public execute.
- Fixed: `estimate_yield_accrual` overflowed (`10000 * 365 * 86400` is computed as int), so the hourly estimate
  never ran. Found by the new PGlite test that runs every job.
- The `app.functions_url` / `app.cron_secret` database settings are no longer needed.

## 2026-10-23 · Sign-in is email and password only (owner's decision)

- Removed every 6-digit code step: the sign-up email code (mobile), the authenticator step at sign-in (mobile,
  web, admin), the authenticator code on withdrawals (mobile, web, `withdraw-request`), and the two-factor switch,
  authenticator setup and backup codes (mobile Profile/Security, web Settings).
- Server: `aal2` is no longer required for customer money actions or staff actions (`_shared/handler.ts`,
  `security-update`), and `app_role()` grants the staff role on any session
  (`20261023000200_password_only_sign_in.sql`). Mobile withdrawals still ask for Face ID / fingerprint / passcode.
- Supabase Auth must have "Confirm email" off (`enable_confirmations = false` locally); otherwise sign-up returns no
  session and the app shows an error.
- Left in place but unused: the backup-code tables and `mfa-backup-verify`, the `mfa-*` / `backup-codes*` actions
  in `security-update`, the access-token hook's backup-code upgrade, and the `mfa-disable` job.
- Risk accepted by the owner: a leaked password now gives full access to a customer's funds or a staff account.
