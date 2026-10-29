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
- **Logos:** web3icons (MIT) for 17 coins, cryptocurrency-icons (CC0) for DOGE, in `packages/tokens/src/coins.ts` (see Top 50 below for the rest).
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
- Fixed (same day): app sign-ups never got a `customers` row (only the seed wrote them). A trigger on `auth.users`
  now creates it from the sign-up metadata, with a unique destination tag and an `ACC-…` reference
  (`20261023000300_customer_on_signup.sql`). Users created without `full_name` (staff) are skipped.

## 2026-10-23 · One mobile app: staff console moved into the app (owner's decision)

- The Next.js staff console (`apps/admin`) and customer web dashboard (`apps/web`) are retired to `old/admin` and
  `old/web`. They are outside the pnpm workspace, so they are no longer built, tested or deployed.
- Staff sign in on the app's normal sign-in screen. If the access token carries `app_role` (from
  `custom_access_token_hook`), the app opens the console at `/ops` instead of the wallet. Customers never see it.
  The console has every page and action the web console had: Overview, Approval queue (approve, reject with reason),
  Transactions (mark a manual withdrawal sent/failed), Users (record deposit, flag, freeze), Reconciliation (run,
  book fee, mark provider contacted), Assets (deposit address and enable), Custody (policy approve/decline) and Audit log
  (CSV export through the phone's share sheet).
- The console's data layer is the web console's, copied to `apps/mobile/src/features/admin/data` unchanged except that
  each Edge Function call reads the current access token (sessions refresh on the phone).
- Staff sessions are kept in memory only. Closing the app, 15 minutes without a touch, or 15 minutes in the background
  signs staff out (same idle limit as the web console).
- Two staff sign-ins (Operations and Compliance) so the two-person approval rule over 1,000 XRP can be met. They are
  created by `supabase/staff-accounts.local.sql` (git-ignored; holds generated passwords). Gmail's `+compliance`
  address delivers to the same inbox as `support.xrp@gmail.com`.
- New Edge Function `staff-password-change`: staff change their own password (current password checked, other sessions
  signed out, audited). Customers keep `security-update` → `password-change`.
- Customer features that were only on the web dashboard are now in the app: transaction history filters
  (All / Received / Sent / Exchanges) and the Transaction emails / Price alerts switches (Profile → Email & alerts).
  The web's help guides replaced two outdated app help topics (XRP-only networks; authenticator recovery).
- Not yet verified: the console against the live Supabase project (needs the access-token hook enabled there) and on a
  physical phone. The Edge Function tests for `staff-password-change` are written but Deno wasn't available to run them.

## 2026-10-23 · Top 50 coins

- 32 coins added (50 in all), taken in order from CoinGecko's market-cap ranking of 2026-10-23: ZEC, HYPE, WBT, LEO,
  NEAR, RAIN, UNI, SUI, HBAR, TAO, CRO, ENA, QNT, BTW, OKB, AAVE, PUMP, ONDO, M, WLD, ASTER, MNT, SKY, WLFI, MORPHO, ICP,
  BGB, VVV, ETC, ARB, JST, GT. Registry: `packages/ledger/src/assets.ts`; database: migration `20261023000400_top_50_assets.sql`.
- Skipped from the ranking: tokenized funds/securities (BUIDL, USYC, USDY, Figure HELOC …), dollar stablecoins and gold
  tokens beyond USDT/USDC (DAI, USDe, USDS, PYUSD, RLUSD, XAUT, PAXG …), Monero (privacy coin, can't be screened),
  Canton and Pi (closed networks).
- Also skipped: SHIB, PEPE, HTX. Prices are stored in micro-dollars ($0.000001), and these trade below $0.00001, so their
  values would be off by 2–25%. Supporting them needs finer price precision across the ledger, SQL and apps.
- New coins: reported deposits (staff-confirmed), no deposit address yet, no Earn product, not loan collateral.
  Limits target USDT's USD values (deposit $10, withdrawal $20, fee $1, or $3 on Ethereum, two approvals over $2,500,
  daily $60,000) at the day's prices. Zcash withdrawals accept transparent (t1/t3) addresses only.
- Logos: 17 web3icons token icons; HYPE, WLD, OKB and BGB use their network/exchange artwork; the other 11 show a
  lettered disc in the coin's colour.

## 2026-10-24 · The owner's 18 coins on 21 networks, with their receive addresses

- Coins cut to the owner's wallet list: XRP, BTC, ETH, USDT, USDC, SOL, BNB, TRX, DOGE, ADA, XLM, HBAR, LTC, CRO, POL,
  plus new ATOM, DASH, FLR. The other 32 stay in `assets` with `enabled = false` (history); the registry and logos
  were trimmed. USDT (Tron, Ethereum), USDC (Ethereum, Solana) and POL (Polygon, Ethereum) take two networks.
- `asset_networks` holds each network's format and platform address (`20261024000100_wallet_networks.sql`). The 21
  addresses were decoded from the QR codes in the owner's Exodus screenshots (`Wallets/`), not typed. XRP's hot
  wallet is the owner's address; customers are still told apart by destination tag.
- Deposit reports and withdrawals carry the network (`p_network`, recorded in `meta.network`); addresses are checked
  against that network. The allowlist accepts an address on any of the coin's networks. Compliance sets an address
  per network in the console (`asset_set_network_address`).
- Receive screen redesigned after the screenshots: network picker, coin logo with network badge, QR on a white tile,
  "Your … address" with copy, the network line, XRP's required tag, and a Share button (system share sheet).
- Open: `XRPL_NETWORK` is still `testnet`, but these are mainnet addresses, and the XRPL worker isn't running, so XRP
  deposits are not credited automatically yet.

## 2026-10-25 · XRP is staff-confirmed like every other coin (owner's decision)

- `assets.deposit_mode` for XRP is now `reported` (`20261025000100_xrp_staff_confirmed.sql`): the customer sends to the
  shared address with their destination tag and reports the hash; staff confirm and approve the credit. The approval
  carries a "Destination tag N" check, because on a shared address only the tag proves whose deposit it is.
- XRP withdrawals are sent by staff and marked sent, like the other coins; the console's "send" panel now follows the
  coin's mode, not the coin name. The XRPL worker reads XRP's mode at start-up and, while `reported`, does not scan
  deposits or send withdrawals (it still records prices and balances and runs jobs). Setting the mode back to
  `automatic` restores the worker path; that needs the worker running against mainnet with a signer.
- With no automatic path, `XRPL_NETWORK` (still `testnet`) only matters to the worker; the app no longer shows it.

## 2026-10-25 · Mainnet only; no provider name on screen

- `XRPL_NETWORK=mainnet` everywhere (live secret, env files, `.env.example`); the worker now defaults to mainnet on
  `wss://xrplcluster.com` with `wss://s1.ripple.com` as fallback. Testnet is a development opt-in only.
- The market-data provider is no longer named in the app ("Live prices · updated …"); stored price sources say
  "Market data".

## 2026-10-27 · Compliance decides identity checks; exchange quotes at live prices

- No KYC provider is contracted, so its webhook never arrived and every customer stayed "in progress". Compliance
  now reviews the uploaded documents in the console (customer → Identity check: images signed for 5 minutes) and
  verifies, asks for more, or rejects (`kyc_review`, `20261027000100_kyc_staff_review.sql`). A reason is required
  except to verify; the customer is notified and the decision is audited. The provider path (`kyc_decided`) remains.
- Customer-facing "[KYC provider]" placeholders replaced: the compliance team reviews documents.
- Exchange quotes came from the liquidity mock (XRP fixed at $2.3742). They now come from the live price feed
  (`createCoinGecko().requestQuote`; both legs in one request, refused if a price is older than 15 minutes); the
  platform spread is still applied in `_shared/quotes.ts`. `MARKET_DATA=mock` keeps sample prices for development.
- Fixed: sign-up account references could collide (first 10 hex of the user id); now md5-derived and retried until unique.

## 2026-10-28 · Upkeep on Supabase; password reset by support; swaps only

- No always-on server and no pg_cron: scheduled upkeep moved from the XRPL worker into the `upkeep` Edge Function,
  which the app calls while it's open (on launch, on return to the foreground and every 5 minutes). Each job runs
  only when due (`upkeep_claim`, `job_runs`), so extra calls are free: prices every 5 minutes, quote expiry every
  minute, loan checks every 5, ledger balances and a heartbeat over XRPL JSON-RPC every 10, yield estimates hourly,
  and the daily reconciliation (23:00 UTC) and audit check (23:30 UTC) on the first call after their time. If nobody
  opens the app, nothing runs until someone does. The console's ledger status is stale after 30 minutes, not 90 seconds.
- Password reset needs no email service: "Forgot password" opens the customer's own email app with a request to
  support.xrpledger@gmail.com (sending from the account's address shows it's theirs). Compliance opens the customer
  in the console → Password → Set a new password (`customer-password-reset`; `customer_password_reset` in SQL):
  every session is signed out, withdrawals pause 24 hours, the customer is notified and it's audited. The password
  is shown once, with a button that drafts the reply email. Supabase's reset-link email is no longer used.
- Exchanges are settled by staff (no liquidity or payout provider): "Sell for USD" asks for the bank, account number
  and account name to pay (stored on the request, shown in the approval checks and on the transaction). Once the
  customer accepts the quote, Operations makes the bank transfer and taps "Mark as paid" with its reference
  (`exchange-complete`, `exchange_complete`, `20261028000200_staff_settled_exchanges.sql`); the customer is notified
  and it's audited. Swaps get "Mark as completed", which credits the bought coin. The provider webhooks remain.
- Legal documents: "[KYC provider]", "[Custody provider]" and "[Support email]" replaced (compliance team, platform
  wallets we control, support.xrpledger@gmail.com). The Terms still need the company's legal details.

## 2026-10-28 · Earn and Borrow run on the platform; manual address checks; Terms taken down

- No yield or lending provider is contracted, so nothing waits for one (`20261028000300_platform_earn_borrow.sql`):
  - Earn: allocating and withdrawing are instant (no approval). The platform pays rewards daily (`yield-rewards` in
    `upkeep`, 00:00 UTC) at the asset's APR less the 10% platform fee, out of platform revenue (`fee_revenue`); rewards
    earned so far are paid before an allocation changes.
  - Borrow: the application carries the bank account to pay. Compliance approves; the collateral locks at once.
    Staff pay the loan by bank transfer and "Mark as funded" with the reference (`loan-settle`); interest accrues
    daily (`loan-interest`). Bank repayments are confirmed by staff ("Mark as received"); repaying by selling
    collateral is instant at the live price. Top-ups lock at once. At 80% LTV the platform sells enough collateral at
    the live price (never older than 15 minutes) to repay the loan, releases the rest, and notifies the customer; a
    shortfall stays owed.
  - The platform's bank details for repayments aren't set yet: the app asks customers to email support for them.
  - Provider webhooks (`provider-webhook-yield`, `provider-webhook-lending`) remain for when providers are contracted.
- Withdrawal address screening is manual: the approval carries "Check the destination address" for the approver
  (block explorer, sanctions and stolen-funds lists). No screening service is called.
- Terms of Service taken down until the company details exist: removed from the live legal documents and the sign-up
  wording; the draft is in `supabase/legal-drafts-terms-of-service.sql` to restore later.
- Prices for money actions fall back to the live feed when the stored price is older than 15 minutes.

## 2026-10-29 · Sheets on Modal; country sets the currency; connecting your own wallet works

- `Sheet` is now built on React Native's `Modal` instead of `@gorhom/bottom-sheet`, which targets gesture-handler v2
  (the app uses v3) and was the likely reason pickers didn't open on Android phones. Same props for every caller;
  the back button and the scrim close it. Long `Select` lists (countries, currencies) get a search box.
- Sign-up lists every country (243, `packages/ledger/src/countries.ts`); picking one sets the display currency
  (changeable at sign-up and in Profile, any of 152 currencies). Values (balances, portfolio, prices, market caps,
  activity, estimates) show in that currency via `useMoney`; money stays in USD underneath. Real US-dollar amounts
  (USD sales, loans) stay in USD with the local equivalent beside them. Rates: `fx_rates`, refreshed hourly by the
  `upkeep` function (`20261029000300_local_currency.sql`).
- Connect a wallet: "Wallet app" (which waited on a non-existent wallet-connection provider) is replaced by scanning
  the wallet's receive QR code; the address field has Paste. Wallets connected before sign-up are kept on the phone
  (addresses only) and linked after sign-up or sign-in. The balance is read at once (`external-wallet`).
- Wallets imported with a recovery phrase can send XRP (`/wallet-send`): the payment is built and signed on the phone
  (`src/lib/xrpl.ts`, ripple-binary-codec + ripple-keypairs) after fingerprint/face/passcode, submitted to the public
  XRP Ledger and reported sent only when validated. Keys are stored per wallet; phones without biometrics fall back
  to the passcode. Tested with a real payment on the XRP testnet.

## 2026-10-29 · Outside wallets on every network; Xaman Secret Numbers

- Watch-only wallets can be on any of the 16 supported networks (`WALLET_NETWORKS` in `@xrp/ledger`): the customer
  picks the network, or scanning/pasting fills it (EVM `0x…` addresses ask which chain). Balances of every asset the
  network carries (e.g. ETH, USDT, USDC, POL on Ethereum) are read from free public endpoints
  (`supabase/functions/_shared/chains.ts`, with fallbacks) when linked and every 10 minutes by `upkeep`; a public
  `wallet-balance` function serves the screen before an account exists. `external_wallets` gains `network` and
  `balances` (`20261029000400_multichain_wallets.sql`). Self-custody (sending) stays XRP-only.
- Xaman wallets import with their Secret Numbers (8 rows A–H of 6 digits, each with a check digit), derived exactly as
  the XRPL Foundation's `xrpl-secret-numbers` (`src/lib/secretNumbers.ts`); the screen asks the customer to check the
  address matches Xaman's.
- Fixed: the XRP address reader found an `r…` fragment inside other networks' addresses (a Tron address read as XRP).

## 2026-10-29 · Crypto trust before an account or a wallet connection

- Welcome's "Create account" and "Connect an existing wallet" (and Sign in's "Create an account") open the crypto
  trust prompt and its 4-step form (`/trust`, `TrustScreen`): trust type (revocable / irrevocable / spendthrift, all
  free) → personal information (name, email, password, phone, date of birth, address, country) → beneficiaries
  (optionally yourself; name, relationship, email, share, wallet; shares must total 100%) → review, agree to the
  Terms and Conditions, create. The email and password create the account, then `create_trust` stores the trust,
  beneficiaries and the personal details on the customer record (`20261029000500_trusts.sql`). "Connect a wallet"
  continues to the wallet screen afterwards; "Create account" to identity verification.
- Accounts without a trust (made before this) are sent to the form after sign-in, with their details prefilled.
- Differences from the supplied form: password is 12+ characters with upper/lower case and a number (the server
  enforces it); country is the full list (it also sets the display currency); phone placeholder is international.
- The console's customer page shows address, crypto trust, beneficiaries and linked wallets
  (`staff_customer_profile`), masked like the rest of the record: Compliance in full, Operations partly, Auditors least.
- The Terms of Service are still taken down, so the form's "Terms and Conditions" link opens the legal documents
  that are live; the Terms need restoring before launch.
