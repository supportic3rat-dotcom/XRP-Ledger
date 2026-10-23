# XRP Ledger Wallet — UI/UX Product Specification

Oct 20, 2026 · @Kamsiyochukwu Brendan Mebuge

## Scope

This spec defines how every screen of the XRP Ledger custodial wallet looks, behaves and responds, so engineering and QA can build and test against it. It covers 21 mobile screens (each in dark and light mode), the desktop dashboard and the seven-view admin console.

| Surface | Frame | Default theme |
| --- | --- | --- |
| Mobile app | 390 × 844, 5-tab bar | Dark, with a light copy of every screen |
| Desktop dashboard | 1440 × 1000 | Light, black accent |
| Admin console | 1440 × 1000, black sidebar | Light |

Each screen spec lists its **elements**, **interactions**, **states** and **acceptance criteria**. Visual tokens, components and the data model live in the companion Design Document; the interactive prototype is the reference when wording here and the prototype disagree on layout.

## Global UX rules

These rules apply to every screen; a screen spec only notes where it departs from them.

**Navigation**

- Five tabs (Home, Markets, Earn, Borrow, Profile) are visible on tab roots only; pushed screens hide the tab bar and show a back button top-left.
- Back always returns to the screen that opened it. Multi-step flows step back one step before leaving the flow.
- Every terminal state (success, rejection, error) offers a next action: Done, View status, or Get help.

**Theming**

- Dark is the default; the Profile theme setting switches to light or follows the system. All colours come from tokens, never hard-coded.
- Red, green and amber only for meaning (loss/error, gain/success, pending/warning), always with a text label.

**Feedback**

- Primary actions respond within 100 ms (pressed state); anything slower than 400 ms shows a spinner inside the button and disables it.
- Completed background actions show a toast for about 3 seconds. Errors that need action show an inline banner, never only a toast.
- Money states use the shared status component and a timeline; nothing is marked complete until confirmed by the ledger or provider.

**Forms**

- Validate on submit, then live once a field has been touched. Errors sit under the field, in red, with `role=alert`.
- Amount fields use the decimal keypad, tabular figures and quick-fill chips; addresses use a mono font, no autocorrect, and a paste button.
- Destructive or irreversible actions need a review step; risky ones also need a checkbox acknowledgement.

**Motion**

- Sheets slide up in 200–250 ms; toggles and chevrons animate in 150 ms. Respect reduced-motion: no slides, fades only.

**Accessibility**

- WCAG 2.1 AA contrast in both themes; 44 × 44 px minimum targets; visible focus ring.
- Labels on every icon button; charts have an aria-label summarising the change; status never relies on colour alone.
- Dynamic type up to 130% without clipping; layouts reflow rather than truncate amounts.

## Navigation map

New customers move left to right through onboarding into Home; returning customers sign in straight to Home.

&#91;embedded content: app navigation · onboarding and 5 tabs\]

Shaded boxes are tab roots; boxes inside each column are screens or sheets pushed from that tab. Connect wallet is optional. Transaction rows on Home and XRP detail also open a detail sheet that links to Help & support.

## Onboarding screens

A new customer reaches Home in six screens; a returning customer reaches it in two.

### Welcome

- **Elements:** brand mark, one-line value statement, primary "Create account", secondary "Connect an existing wallet", text link "I already have an account · Sign in", footer links to Terms and Privacy (Legal).
- **Acceptance:** each control opens its screen; no balance or market data before sign-in.

### Sign in

- **Elements:** email, password with show/hide, "Forgot password?", primary "Sign in", link to Create account.
- **Interactions:** sign in → 2FA step (6-digit code, or "Use a backup code" for 8 digits) → Home. Forgot password → email field → "Check your email" confirmation.
- **States:** wrong password shows "Email or password is incorrect" and attempts left; locked after 5 attempts with a Support link; lost 2FA links to Support.
- **Acceptance:** codes auto-advance and accept paste; the reset confirmation never reveals whether the email exists.

### Connect wallet

- **Elements:** three method cards: Wallet app, Public address (watch-only), Recovery phrase.
- **Interactions:** Wallet app → mobile deep link, QR, or hardware → waiting screen → approved. Address → validate `r` + base58 (25–35 characters) → watch-only connected. Recovery phrase → 12/24-word toggle → "Before you import" checklist → word grid with checksum tick → Import → "Wallet imported (self-custody)".
- **States:** invalid address, rejected connection, bad checksum, each with a retry.
- **Acceptance:** all routes end with "Continue to custodial account" (Create account). Phrase words are never sent to a server or logged.

### Create account

- **Elements:** full name, email, country, password with rules, Terms and Privacy checkbox, primary "Continue", link to Sign in.
- **Interactions:** continue → 6-digit email code (resend after 30 s) → Verify.
- **Acceptance:** password needs 12+ characters with upper, lower and a number; all errors show at once on first submit.

### Verify

- **States:** not started, in progress, needs more info, verified, rejected, restricted; each with its own title, explanation and primary action.
- **Acceptance:** not started / needs info → Identity capture; verified → Home; rejected / restricted → Help & support. Unverified users can browse but not deposit, withdraw or exchange, and disabled actions say why.

### Identity capture

- **Steps:** document type and issuing country → front → back (skipped for passports) → selfie → proof of address (upload) → review with consent checkbox → submitted.
- **Interactions:** each capture step shows framing guidance, a retake option and a progress indicator (step x of y).
- **Acceptance:** back steps one step; submitted screen offers "View status" (Verify) and "Go to Home".

## Wallet screens

The wallet screens answer three questions: how much do I have, where is it, and what is moving.

### Home (tab)

- **Elements:** greeting, bell with unread count, total balance in USD and XRP with a hide-amounts toggle, "Where your XRP is" breakdown (available / yield / collateral) linking to XRP detail, quick actions (Deposit, Withdraw, Exchange, History), pending-deposit banner, recent activity (5 rows), tab bar.
- **Interactions:** tap a transaction → detail sheet (amount, status, key-value details, explanatory note, "Get help with this" → Support). History → full activity sheet.
- **States:** empty (no deposits yet: a deposit prompt), unverified (actions disabled with a reason), pending deposit, hidden amounts (shown as ••••).
- **Acceptance:** breakdown sums to the total; pending deposits never add to the balance.

### Notifications

- **Elements:** back, "Read all", filter (All, Activity, Security), groups Today / Earlier, rows with icon, title, body, time and an unread dot.
- **Interactions:** tap → marks read and opens the related screen; "Read all" disables once nothing is unread.
- **Acceptance:** notifications never show full addresses, balances or codes.

### XRP detail

- **Elements:** indicative price, change for the period, line chart with periods 1D, 1W, 1M, 3M, 6M, 1Y, ALL; Deposit / Withdraw / Exchange; Your XRP (total, available, yield → Earn, collateral → Borrow); XRP activity; About XRP here.
- **Interactions:** period chips redraw the chart; activity rows open the detail sheet.
- **Acceptance:** price shows source and update time; change is green for up, red for down, with a sign.

### Markets (tab)

- **Elements:** search, list of assets; XRP is live, others are labelled "Coming later" and can't be opened.
- **Interactions:** tap XRP → expands with "View XRP details" and "Deposit XRP".

### Deposit

- **Elements:** network (XRP Ledger), shared address and destination tag with copy buttons and QR, warning card about the tag, minimum and credit timing.
- **States:** copied (toast), unverified (blocked with Verify link).
- **Acceptance:** tag is shown as prominently as the address; the screen says unsupported tokens may be lost.

### Withdraw

- **Steps:** address (allowlisted picker or new) + optional tag + amount with Max → review (amount, fee 0.25 XRP, receive amount, destination) → 2FA → status timeline (Submitted, In review, Approved, Sent, Completed).
- **States:** invalid address, above available, below minimum, allowlist blocks a new address, over 1,000 XRP shows "needs two approvals".
- **Acceptance:** available balance drops into Reserved at submit; Completed only after ledger validation.

### Exchange

- **Steps:** XRP amount → indicative USD and fees → submit request → firm quote with expiry countdown → accept → payout status.
- **States:** quote expired (request a new one), rejected with reason, payout account unverified.
- **Acceptance:** no XRP is reserved before the customer accepts a firm quote.

## Product screens

Product screens show risk before the action and the exact effect of the action before it is confirmed.

### Earn (tab)

- **Elements:** XRP Flexible card (allocated 1,500 XRP, sample APR 3.00%, fee 10%, credited and estimated rewards), "Allocate more", "Withdraw from XRP Flexible", how rewards work, risk notes, provider name.
- **Interactions:** Allocate → sheet with amount (minimum 50, maximum available) and terms checkbox → toast. Withdraw → sheet with amount (maximum 1,500, "All"), timing note → toast.
- **States:** below minimum, above balance, terms not accepted, provider delayed (amber banner).
- **Acceptance:** rates are labelled variable and sample; estimated rewards are labelled estimates until credited.

### Borrow (tab)

- **Elements:** loan card (LN-PROTO-0007, $604.93 owed, 10% APR, next interest date), LTV meter with zones (healthy < 65%, margin call 65–80%, liquidation ≥ 80%), current 33.9%, collateral 750 XRP, liquidation price, Repay and Add collateral, new-loan calculator.
- **Interactions:** Repay / Add collateral → Manage loan in that mode.
- **Acceptance:** the meter marker and percentage always agree; zones are labelled in words, not only colour.

### Manage loan

- **Modes:** segmented Repay | Add collateral, with a loan summary card.
- **Repay:** amount with chips (Interest $4.93, Half $302.47, Full $604.93), pay by bank transfer or by selling XRP, live "left to repay" and "LTV after" → review → status (Request recorded → Awaiting payment / Selling XRP → Payment received → Applied). Bank route shows payment details and reference.
- **Add collateral:** XRP amount (minimum 50, chips +250 / +500 / +1,000), live collateral, LTV and liquidation price after → review with required acknowledgement → status (Recorded → Sent to provider → Lock confirmed → LTV updated).
- **Acceptance:** a full repayment shows "750 XRP released to available"; balances change only at the provider-confirmed step.

### Custody

- **Elements:** how assets are held (provider, segregation, cold/hot split in plain words), latest reconciliation date, withdrawal allowlist status → Security, documents → Legal.
- **Acceptance:** no claims of insurance or licences unless confirmed; placeholders stay bracketed.

## Account screens

Account screens group everything about identity, protection and paperwork under Profile.

### Profile (tab)

- **Elements:** name, masked email, verification badge; rows for Security settings, Notifications, Theme (Dark / Light / System), Currency, Help & support, Legal & disclosures, Custody; Sign out.
- **Acceptance:** every row opens its screen; Sign out asks for confirmation and returns to Welcome.

### Security

- **Elements:** 2FA toggle, Backup codes (x of 8 unused), Password (last changed), allowlist toggle with saved addresses and "Add address", signed-in devices, recent security activity, Support link.
- **Interactions:** 2FA off → amber warning about a 24-hour hold. Backup codes → sheet with codes and "Generate new codes" (old ones stop working). Password → sheet (current, new, confirm) → other devices signed out. Add address → sheet (name, address, optional tag) → "Activates in 24h". Remove address and sign out device → immediate, with a toast.
- **Acceptance:** the current device can't be signed out from this list; every change appears in recent activity.

### Help & support

- **Elements:** safety banner, Your requests (reference, status, expandable message thread), searchable help topics (accordion), fixed "New request" button.
- **Interactions:** New request → sheet: topic (required), related transaction (optional), message (20+ characters) → new request at the top, expanded, with an auto-reply.
- **States:** no topics match the search (suggests a request).
- **Acceptance:** placeholder text warns not to include passwords or codes.

### Legal & disclosures

- **Elements:** "One document has changed" banner, documents grouped by Account, Custody & payments, Products; each row with version and status (Accepted, Review update, For reference).
- **Interactions:** open → outline, "What changed" (if updated), acceptance record (version, time, where, consent ID). Fees and Charges v0.2 needs a checkbox and "Accept v0.2".
- **Acceptance:** accepting updates the list, clears the banner and issues a new consent ID; drafts are labelled as drafts.

## Desktop dashboard and admin console

Both desktop surfaces use a sidebar plus a main area that lays out as list + detail panel, collapsing to one column under 760 px.

### Desktop dashboard (customer)

- **Elements:** sidebar nav, Overview header with total value and change, portfolio chart with period picker, action buttons (Deposit, Withdraw, Exchange), holdings table, recent activity list.
- **Acceptance:** same figures and statuses as the mobile app; the chart has hover values and an aria summary.

### Admin console (staff)

| View | Layout | Key interactions | Role rules |
| --- | --- | --- | --- |
| Overview | 4 metric cards, provider health, needs-attention list | Cards and items jump to their view with the item selected | All roles see it |
| Approval queue | Type filter, queue table, detail panel | Approve; Reject with reason + note (10+ characters) | Ops: withdrawal, deposit, exchange, yield. Compliance: withdrawal, deposit, loan. Second approval must be a different role |
| Transactions | Type filter, table, detail panel | Detail shows journal and timeline; "Open in approval queue" when pending | View only for all |
| Reconciliation | Run header, wallet comparison table, liabilities, exceptions | Run now; book fee adjustment; mark provider contacted; open deposit exception in queue | Ledger actions: Ops only |
| Users | Search, customer table, detail panel | View transactions; Flag for review; Freeze / Unfreeze | Personal data: Compliance full, Ops partial, Auditor masked. Freeze: Compliance only |
| Custody | Wallets table, signing policy, signers, limits bar, pending policy change | Approve or decline the change | Compliance only, since Ops requested it |
| Audit log | Actor filter, append-only table with hashes | Export CSV (logged) | All roles |

- **Acceptance:** disabled actions show the reason beside them; every action in any view appears at the top of the Audit log with the actor's role; a rejection shows the compensating journal entry.

## Copy and microcopy

The voice is calm, plain and exact: say what happened, what it means for the customer's money, and what to do next.

- Use sentence case, second person ("your XRP"), and numbers with units ("0.25 XRP", "24 hours").
- Errors say what is wrong and how to fix it; never blame ("That address isn't valid" not "You entered an invalid address").
- Never promise outcomes: "usually within an hour", not "instant"; "sample rate", not "guaranteed".
- Buttons are verbs that name the result ("Confirm and lock XRP", not "OK").

| Context | String |
| --- | --- |
| Invalid address | Enter a valid XRP Ledger address. |
| Amount above balance | You only have 4,170.10 XRP available. |
| Below minimum | The minimum top-up is 50 XRP. |
| Pending deposit | 1,250.00 XRP is waiting for ledger validation. It's not in your balance yet. |
| Missing tag warning | Always include your destination tag. Without it, your deposit can be delayed by days. |
| Withdrawal in review | Every withdrawal is reviewed before it's sent. Over 1,000 XRP needs two approvals. |
| Rejected exchange | Rejected: payout account not yet verified. No XRP was reserved. |
| Collateral acknowledgement | I understand this XRP will be locked and can be sold by \[Lending provider\] if my LTV reaches 80%. |
| 2FA off warning | Turning off two-factor takes effect after a 24-hour hold, and withdrawals pause during that time. |
| Support safety | We'll never ask for your password, 2FA codes or recovery phrase, or ask you to send funds. |
| Unverified action | Verify your identity to withdraw. |
| Empty notifications | Nothing here yet. |

## Release acceptance checklist

A build is ready for review when every item below passes on iOS, Android and desktop web, in both themes.

- [ ] Every screen in the navigation map is reachable, and back returns to the opener.
- [ ] No dead links or buttons; disabled controls state why.
- [ ] Dark and light themes match the token table; no hard-coded colours.
- [ ] Balances agree across Home, XRP detail, Earn, Borrow and the desktop dashboard.
- [ ] No money state shows complete before ledger or provider confirmation.
- [ ] Every form shows the specified validation errors and recovers once fixed.
- [ ] Withdraw, Exchange, Manage loan and Legal acceptance each have a review step.
- [ ] Recovery phrase words are never logged, stored server-side or kept in memory after import.
- [ ] Admin role rules hold: forbidden actions disabled with a reason, and every action logged.
- [ ] Personal data is masked per role in the admin console.
- [ ] WCAG 2.1 AA contrast, 44 px targets, screen-reader labels, reduced motion and 130% text pass.
- [ ] Copy matches the strings table; no unconfirmed claims about licences, insurance or returns.
