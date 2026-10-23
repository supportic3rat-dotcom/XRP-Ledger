# XRP Ledger Custodial Wallet — Design Document

Oct 20, 2026 · @Kamsiyochukwu Brendan Mebuge

## Overview

This is a custodial wallet for native XRP on the XRP Ledger. It ships as a 390 × 844 mobile app with a 5-tab nav, a 1440 × 1000 desktop dashboard, and a 1440 × 1000 staff admin console. The platform holds customer XRP through a third-party custody provider. Customers can deposit, withdraw, exchange to fiat by manual request, earn yield and borrow against XRP.

**Goals**

- Make it obvious where every XRP is: available, allocated to yield, or locked as collateral.
- Show money states honestly: pending, validating or awaiting approval are never shown as done.
- Every flow ends somewhere useful: a status timeline, a receipt, or Support.
- Dark mode is the default, with a full light-mode copy of every mobile screen.

**Non-goals for v1**

- Tokens issued on the XRP Ledger (issuer + currency code), other networks, and instant automated exchange.
- Self-custody signing inside the app. A connected self-custody wallet can be watched or imported, but custodial features need a custodial account.

**Status:** interactive prototype with sample data only. Nothing in it is rendered from live services, and providers are named as placeholders such as \[Custody provider\].

## Users and roles

There are four roles: one customer role and three staff roles. Staff permissions enforce separation of duties: nobody approves their own request, and withdrawals over 1,000 XRP need two different people, one of them from Compliance.

| Role | Surface | Can do | Cannot do |
| --- | --- | --- | --- |
| Customer | Mobile app, desktop dashboard | Sign up, verify identity, deposit, withdraw, exchange, earn, borrow, manage security, contact support | See other customers, change limits |
| Operations Administrator | Admin console | Approve withdrawals, deposits, exchange and yield; post reconciliation adjustments; flag customers for review | Approve loans, freeze accounts, approve policy changes it requested, give the second approval after its own role |
| Compliance Officer | Admin console | Approve withdrawals, deposit attribution and loans; freeze and unfreeze accounts; approve signing-policy changes; see full personal data | Post ledger adjustments |
| Read-Only Auditor | Admin console | View everything, export the audit log | Any action; sees masked personal data only |

## Information architecture

The app has 21 mobile screens, each in dark and light (42 files), plus the desktop dashboard and the admin console. The mobile tab bar has five tabs: Home, Markets, Earn, Borrow, Profile. Every other screen is pushed from one of them and has a back button to its parent.

| Area | Screen | Reached from | Purpose |
| --- | --- | --- | --- |
| Onboarding | Welcome | App start | Create account, connect existing wallet, or sign in |
| Onboarding | Sign in | Welcome, Create account | Email + password, then 2FA or backup code; forgot password |
| Onboarding | Connect wallet | Welcome | Wallet app (QR / hardware), watch-only address, or recovery-phrase import |
| Onboarding | Create account | Welcome, Connect wallet | Details form, then email code |
| Onboarding | Verify | Create account, Identity capture | Verification status (six states) |
| Onboarding | Identity capture | Verify | ID type and country, front, back, selfie, proof of address, review |
| Wallet | Home (tab) | Sign in, Verify | Total balance, breakdown, quick actions, activity |
| Wallet | Notifications | Home bell | Activity and security alerts, each linking to its screen |
| Wallet | XRP detail | Home balance, Markets | Price chart, actions, where your XRP is, XRP activity |
| Wallet | Markets (tab) | Tab bar | Supported assets; XRP live, others marked coming later |
| Wallet | Deposit | Home, XRP detail, Markets | Shared address + destination tag |
| Wallet | Withdraw | Home, XRP detail | Address, tag, amount, review, 2FA, status timeline |
| Wallet | Exchange | Home, XRP detail | Manual XRP to fiat request, quote, status |
| Products | Earn (tab) | Tab bar | XRP Flexible allocation and withdrawal |
| Products | Borrow (tab) | Tab bar | Loan summary, LTV meter, new loan |
| Products | Manage loan | Borrow | Repay or add collateral: form, review, status |
| Products | Custody | Profile, Home | How assets are held, proof, documents |
| Account | Profile (tab) | Tab bar | Account, settings, theme, links to the screens below |
| Account | Security | Profile, Custody, Notifications | 2FA, backup codes, password, allowlist, devices |
| Account | Help & support | Profile, transaction sheets, Verify | Requests, help topics, new request |
| Account | Legal & disclosures | Profile, Welcome, Custody | Nine draft documents and acceptance records |
| Desktop | Dashboard | Web sign-in | Portfolio chart, holdings, actions, activity |
| Staff | Admin console | Staff sign-in | Seven views (see Admin console) |

## Key user flows

Each money flow follows the same shape: form, review, confirm, then a status timeline that only says "done" once the provider or the ledger confirms it.

**Onboarding**

1. Welcome: choose Create account, Connect an existing wallet, or Sign in.
2. Connect wallet (optional): pick a wallet app, a watch-only address, or a recovery-phrase import, then continue to Create account.
3. Create account: name, email, country, password and terms, then a 6-digit email code.
4. Verify: status screen. Not started or in progress leads to Identity capture; rejected or restricted leads to Support.
5. Identity capture: document type and country, front, back (skipped for passports), selfie, proof of address, review with consent, done.
6. Home.

**Sign in**

1. Email and password. A wrong password shows an error with attempts left.
2. Two-factor: 6-digit authenticator code, or an 8-digit backup code.
3. Home. Forgot password sends a reset link; lost 2FA goes to Support.

**Deposit**

1. Show the shared XRP address and the customer's destination tag, with copy buttons and a warning that a missing tag delays credit.
2. The deposit appears as Validating, then Credited after ledger validation and screening.

**Withdraw**

1. Enter the address (validated), destination tag and amount (fee 0.25 XRP).
2. Review, then confirm with 2FA.
3. Status: Submitted, In review, Approved, Sent, Completed after validation. Over 1,000 XRP needs two approvals.

**Exchange (manual)**

1. Request XRP to USD with an indicative price.
2. Staff request a firm quote; the customer accepts it before XRP is reserved.
3. Payout to the verified bank account. A rejection reserves nothing.

**Earn**

1. Allocate XRP to XRP Flexible (minimum 50 XRP) after accepting the product terms.
2. Withdraw from XRP Flexible: amount up to the allocated 1,500 XRP, review, then a confirmation.

**Borrow**

1. Borrow tab: loan summary, LTV meter with zones at 65% (margin call) and 80% (liquidation).
2. Manage loan, Repay: amount (interest, half or full), pay by bank or by selling XRP, review, status timeline.
3. Manage loan, Add collateral: XRP amount (minimum 50), new LTV and liquidation price, acknowledgement, status timeline.

**Account**

- Security: 2FA toggle (turning off has a 24-hour hold), backup codes, change password (signs other devices out), withdrawal allowlist (new addresses activate after 24 hours), devices.
- Help & support: existing requests with message threads, searchable topics, new request (topic, related transaction, at least 20 characters).
- Legal: open a document, read its outline and acceptance record, accept the updated Fees and Charges v0.2.
- Notifications: filter by type, tap one to open its screen, mark all read.

## Visual design system

The theme is black and white. Dark mode is mostly black with white type and actions; light mode is mostly white with black. Red, green and amber appear only where they carry meaning: loss or error, gain or success, pending or warning.

**Colour tokens**

| Token | Dark (default) | Light | Used for |
| --- | --- | --- | --- |
| `--bg` | `#000000` | `#FFFFFF` | Page background |
| `--surface` | `#0D0D0D` | `#FFFFFF` | Cards, sheets |
| `--sunken` | `#1A1A1A` | `#F4F4F4` | Chips, segmented controls, inset areas |
| `--border` | `#242424` | `#E6E6E6` | Card and row dividers |
| `--border-strong` | `#383838` | `#D4D4D4` | Inputs, secondary buttons |
| `--text` | `#FFFFFF` | `#0A0A0A` | Primary text |
| `--text-2` | `#BDBDBD` | `#474747` | Secondary text |
| `--text-3` | `#8F8F8F` | `#6B6B6B` | Hints, timestamps |
| `--accent` | `#FFFFFF` | `#0A0A0A` | Primary buttons, chart line, selected states |
| `--on-accent` | `#000000` | `#FFFFFF` | Text on primary buttons, toggle knob |
| `--accent-soft` | `#1F1F1F` | `#F0F0F0` | Focus ring halo |
| `--pos` | `#4ADE80` | `#15803D` | Gains, Completed, Credited |
| `--neg` | `#EF4444` | `#C81E1E` | Losses, errors, Rejected, unread dot |
| `--warn` / `--warn-soft` | `#FACC15` / `#262006` | `#A16207` / `#FEF6E0` | Pending, warnings |
| `--neg-soft` | `#2A0D0D` | `#FDECEC` | Error banners |

The admin console uses its own light, neutral palette with a black sidebar and a `#0A0A0A` accent.

**Typography**

- Geist for UI text and Geist Mono for addresses, tags, references and codes (Google Fonts).
- Base 14 px, line height 1.4. Screen titles 17/600, section labels 13/600 in `--text-2`, hints 12–12.5 px.
- Balances 28–32 px, weight 500, letter spacing −0.02 em, tabular figures for every number.

**Layout and shape**

- Mobile frame 390 × 844; 16 px side gutter; content scrolls under a fixed footer or tab bar.
- Radius 12 px for cards, buttons and inputs; 16 px top corners for sheets; 8 px for chips.
- Touch targets at least 44 × 44 px; primary buttons 52 px tall, full width.
- Icons: inline stroke SVG on a 24 px grid, 1.6 px stroke, round caps and joins.

## Components and states

About fifteen shared components make up every screen. Build them once as a component library before building screens.

| Component | Variants | States and rules |
| --- | --- | --- |
| Button | Primary (accent fill), secondary (outline), danger (red text), mini (32 px) | Default, pressed, disabled with a visible reason nearby, loading |
| Icon button | Back, close, bell, chart | 44 × 44 hit area; bell shows an unread count in its label |
| Card | Plain, with rows | 1 px border, 12 px radius, rows divided by borders |
| Row | Static, link (chevron), button | 56–60 px tall; title + secondary line + trailing value or status |
| Key-value list | — | Label left in `--text-3`, value right, wraps long values |
| Input | Text, amount (26 px), address (mono), select, textarea | Focus ring, invalid border in red, error text below with `role=alert` |
| Chips | Period picker, amount shortcuts | Selected chip uses `--sunken` |
| Segmented control | 2–3 options | One selected, `aria-pressed` |
| Toggle | — | `role=switch`; knob uses `--on-accent` so it shows in dark mode |
| Status | ok, wait, bad, off | Coloured dot + label; never colour alone |
| Banner | info, warn, error | Icon + one or two sentences |
| Timeline | — | Done (filled), now (amber halo), upcoming (hollow) |
| Bottom sheet | Transaction detail, forms | Scrim closes it; grab handle; up to 86–90% height |
| Toast | — | Inverse colours, 2.8–3 s, `role=status` |
| Tab bar | 5 tabs | Current tab has `aria-current` |

**Empty, error and edge states shown in the prototype**

- No notifications in a filter, no help topics matching a search, no admin queue items in a category.
- Disabled quick actions explain why (for example, unverified accounts cannot withdraw).
- Validation on every form: address format, amounts above balance or below minimums, mismatched passwords, short messages.

## Sample data model

Every screen uses the same sample customer, so the numbers agree across the app. Reuse these as seed data and as test fixtures.

| Item | Value |
| --- | --- |
| XRP indicative price | $2.38 |
| Total custodial XRP | 6,420.10 XRP ($15,279.84) |
| Available | 4,170.10 XRP |
| Allocated to yield (XRP Flexible) | 1,500.00 XRP |
| Locked as collateral | 750.00 XRP |
| Pending deposit | 1,250.00 XRP · DEP-PROTO-2041 · tag 48201937 |
| Loan LN-PROTO-0007 | $600 principal + $4.93 interest = $604.93 owed · 10% APR · funded Sep 19 |
| Loan thresholds | Margin call 65% LTV · liquidation 80% LTV · current 33.9% |
| Yield | 3.00% APR sample · 10% platform fee · last credit 1.89 XRP (Oct 3) |
| Withdrawal fee | 0.25 XRP plus network fee |
| Rejected exchange | EX-PROTO-0301 · payout account not verified |
| Legal update | Fees and Charges v0.2 needs acceptance |

**Core entities for the real build**

- **Customer:** id, profile, verification status, risk rating, limits, flags, frozen.
- **Ledger account:** per customer and per state (available, reserved, pending yield, yield, collateral), plus platform accounts (custody omnibus, suspense, fee revenue).
- **Journal entry:** balanced debits and credits; posted entries are never edited, only reversed by a compensating entry.
- **Transaction:** deposit, withdrawal, exchange, yield, loan; status history; on-ledger hash and ledger index.
- **Approval:** request, approver, role, time, decision, reason.
- **Loan:** principal, interest, collateral, LTV, thresholds, repayments.
- **Consent:** document, version, time, where accepted.
- **Audit event:** actor, action, target, time, hash of the previous event.

## Admin console

The console is a desktop app with a black sidebar and seven views. Every staff action is written to the audit log with the person's role, and the prototype's role switcher shows what each role can and cannot do.

| View | What it shows | Actions and rules |
| --- | --- | --- |
| Overview | Pending approvals, customer liabilities and coverage, open reconciliation exceptions, outflow vs daily limit; provider health; a needs-attention list | Every card and item jumps to its view |
| Approval queue | Requests by type with checks, approvals, ledger journal and audit trail | Approve or reject with a reason and note; two approvals from different roles over 1,000 XRP; rejection posts a compensating entry |
| Transactions | All customer movements with filters | Detail panel with on-ledger evidence, journal and timeline; jump to the queue item |
| Reconciliation | Internal ledger vs custody provider vs XRP Ledger per wallet; liabilities vs holdings | Exceptions: Operations posts fee adjustments and records provider contact; deposit exceptions resolve through the queue |
| Users | Customer list with search; detail with personal data, balances, flags | Personal data masked by role (Compliance full, Operations partial, Auditor masked); Compliance freezes accounts; Operations flags for review |
| Custody | Hot, warm and cold wallets; signing policy; signers; limits and outflow | A policy change requested by Operations needs Compliance approval and applies after 24 hours |
| Audit log | Staff, customer and system events, filterable | Append-only, each entry hashes the previous one; CSV export is itself logged |

**Sample custody figures:** hot 84,210.25 XRP (ceiling 100,000), warm 250,000.00, cold 950,400.00; total 1,284,610.25 XRP covering 1,284,110.25 of customer balances plus 500.00 in suspense.

## Trust, safety and content principles

The product handles other people's money, so the design favours clear, accurate states over reassurance.

- **Statuses only reflect confirmed facts.** A balance moves only after ledger validation or provider confirmation. "Completed" means validated on the ledger.
- **Recovery phrase.** The prototype shows display-only word slots filled with sample words, so a real phrase can never be typed into a shared page. In the real app, phrase entry must happen on-device, never be logged or sent to a server, and be cleared from memory after import. The app shows a "Before you import" checklist first.
- **Support never asks for secrets.** Support, Help topics and the sign-in screens all repeat that staff never ask for passwords, 2FA codes or recovery phrases, or ask customers to send funds.
- **Friction where it protects.** 24-hour holds after turning off 2FA, changing the password, or adding an allowlist address; 2FA on every withdrawal.
- **Plain language.** Short sentences, specific numbers, no hype about returns; risks shown before an action, not after.
- **Placeholders, not claims.** Provider names stay in brackets (\[Custody provider\], \[KYC provider\], \[Yield provider\], \[Lending provider\], \[Market data provider\], \[Screening provider\]). Legal documents are draft outlines, and no licences or approvals are claimed.
- **Accessibility.** WCAG AA contrast in both themes, 44 px targets, status never shown by colour alone, labelled controls, focus rings, screen-reader labels on charts.

## Build handoff

The recommended split is an Expo (React Native) app for mobile, Next.js for the desktop dashboard and the admin console, and one backend that owns the ledger. Treat the prototype's `.dc.html` files as the visual and behavioural reference, not code to port.

**Suggested build order**

1. Design tokens (both themes) and the component library from Components and states.
2. Backend: double-entry ledger, transactions, approvals and audit log, seeded with the sample data.
3. Onboarding and sign-in, with a mocked KYC provider.
4. Home, Notifications, XRP detail, Deposit and Withdraw against the XRP Ledger testnet.
5. Admin console: queue, transactions, reconciliation, audit log, then users and custody.
6. Exchange, Earn and Borrow behind provider adapters.
7. Security, Support and Legal; light-mode pass; accessibility audit.

**Integrations to choose (placeholders today)**

| Placeholder | Needed for |
| --- | --- |
| \[Custody provider\] | Wallets, signing, balance sync |
| \[KYC provider\] | Identity capture and verification status |
| \[Screening provider\] | Deposit and withdrawal destination screening |
| \[Liquidity provider\] + bank payout | Manual exchange quotes and fiat payouts |
| \[Yield provider\] | XRP Flexible allocation, rewards, redemptions |
| \[Lending provider\] | Credit decisions, funding, liquidation |
| \[Market data provider\] | Prices and charts |
| XRP Ledger nodes | Deposit monitoring, validation, ledger evidence |

**Open questions**

- [ ] Which operating company and jurisdictions, and therefore which licences and final legal wording?
- [ ] Which payout currencies besides USD (for example NGN)?
- [ ] Is the desktop dashboard a customer web app at launch, or later?
- [ ] Final withdrawal thresholds, daily limits and hot-wallet ceiling.
- [ ] Notification channels: push, email, SMS.
