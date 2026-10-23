# XRP Ledger Wallet — User Flows Guide

Oct 20, 2026 · @Kamsiyochukwu Brendan Mebuge

## How to read this guide

This guide walks through every flow in the XRP Ledger custodial wallet, screen by screen, using the exported designs. Mobile screens are shown in dark mode, which is the default; every one also exists in light mode with the same layout and behaviour. The admin console is shown as the Operations role.

The app has five tabs: **Home, Markets, Earn, Borrow, Profile**. Every other screen opens from one of them and has a back arrow to return. All numbers are sample data for one customer: 6,420.10 XRP in custody, made up of 4,170.10 available, 1,500 in yield and 750 locked as loan collateral, at a sample price of $2.38.

## 1. New customer onboarding

A new customer goes from first launch to a verified account in four screens, then lands on Home.

&#91;image: Onboarding screens: Welcome, Create account, Verify, Identity capture\]

1. **Welcome.** Explains the product in three points: institutional custody, yield, and borrowing. It offers three ways in: **Create account**, **Connect an existing wallet**, or **I already have an account · Sign in**. Terms and Privacy links open Legal.
2. **Create account (step 1 of 3).** Full legal name, email, password (12+ characters, a number, upper and lower case), country and display currency, plus the Terms checkbox. **Continue** validates every field at once, then asks for a 6-digit code sent by email.
3. **Verify (step 3 of 3).** Shows the verification status and what will be checked: photo ID, selfie and proof of address. It also lists what verification unlocks (deposits, withdrawals, exchange, yield, borrowing). The main button starts Identity capture; if the account were rejected or restricted, it would go to Help & support instead.
4. **Identity capture (6 steps).** Choose the ID type and issuing country → photograph the front → the back (skipped for passports) → take a selfie → upload proof of address → review and consent. Photos go straight to the KYC provider and are not saved to the camera roll. The last step offers **View status** (back to Verify) or **Go to Home**.

Until verification completes, the customer can look around the app, but money actions are disabled with a short reason such as "Verify your identity to withdraw".

## 2. Sign in and connect an existing wallet

Returning customers sign in to Home in two steps. Anyone with a self-custody XRP wallet can link it first, before opening the custodial account.

&#91;image: Sign in and Connect a wallet screens\]

**Sign in**

1. Enter email and password (with Show/Hide) and tap **Sign in**. A wrong password shows an error with the attempts left.
2. Enter the 6-digit code from the authenticator app, or tap "Use a backup code" and enter an 8-digit one.
3. Land on Home.

**Forgot password?** opens an email field, then a "Check your email" confirmation. Lost access to two-factor goes to Help & support. "Create an account" goes back to Create account.

**Connect a wallet you already own** has three tabs:

- **Wallet app:** choose the XRPL wallet on this phone, a wallet on another device (scan a QR code), or a hardware wallet. A waiting screen appears until the wallet approves.
- **Address:** paste a public address (it must start with "r"). It is added as watch-only: the balance is visible, but nothing can be sent.
- **Recovery phrase:** pick 12 or 24 words, read the "Before you import" checklist, then fill the word grid. A checksum tick confirms the phrase is valid before **Import**. In the prototype the grid only accepts sample words, so a real phrase is never typed in.

Every route ends with **Continue to custodial account**, which opens Create account. A connected wallet stays self-custody and separate from the custodial balance.

## 3. Home, Notifications, XRP detail and Markets

Home answers three questions: how much is there, where is it, and what is moving. Every other part of the app is one tap away from it.

&#91;image: Home, Notifications, XRP detail and Markets screens\]

**Home (tab)**

- The top card shows the total custodial value ($15,279.84), its change for the chosen period, and a chart with 1D to ALL periods.
- **Quick actions:** Deposit, Withdraw, Exchange, Earn, Borrow and History. History opens a sheet with the full activity list.
- **Where your XRP is · 6,420.10** splits the balance into available, allocated to yield, and locked as collateral. **XRP details** opens the XRP detail screen.
- Recent activity lists transactions. Tapping one opens a detail sheet with the amount, status, references and a **Get help with this** link to Help & support. A pending deposit shows as Validating and is not counted in the balance.
- The bell (with a red unread dot) opens Notifications.

**Notifications:** filter by All, Activity or Security, grouped into Today and Earlier. Tapping a notification marks it read and opens its screen: a new sign-in opens Security, an interest reminder opens Manage loan, a terms update opens Legal. **Read all** clears the unread dots.

**XRP detail:** indicative price ($2.3800) with a period chart, then Deposit / Withdraw / Exchange buttons. **Your XRP** shows totals, with yield linking to Earn and collateral linking to Borrow. XRP activity rows open the same detail sheet as Home. **About XRP here** covers the network, shared address + tag, and the 0.25 XRP withdrawal fee.

**Markets (tab):** a Supported / All prices switch. XRP is the only supported asset. Tapping it expands its network and support details plus **View XRP details** and **Deposit XRP**. Bitcoin, Ethereum, Solana and Litecoin are "Price only" and can't be deposited.

## 4. Deposit, Withdraw and Exchange

All three money flows share one pattern: enter the details, review, confirm, then follow a status timeline. A step is shown as done only once the XRP Ledger or a provider confirms it.

&#91;image: Deposit, Withdraw and Exchange screens\]

**Deposit**

1. Choose the asset. XRP is selected; Bitcoin and Ethereum are listed as "Planned".
2. The network is fixed to XRP Ledger.
3. **Send to** shows a QR code, the shared deposit address with **Copy address**, and the customer's destination tag (48201937) with **Copy tag**.
4. An amber warning explains that the address is shared, so the tag must always be included and only native XRP sent.
5. The minimum deposit is 10 XRP and there is no fee. The deposit then appears on Home as Validating, and becomes Credited after ledger validation and screening.

**Withdraw**

1. The asset and network are fixed to XRP on the XRP Ledger.
2. Paste the destination address and enter its destination tag, or tick "The recipient doesn't use a destination tag".
3. Enter the amount, then **Continue** to review the fee (0.25 XRP), the amount received and the destination.
4. Confirm with a two-factor code.
5. Follow the status: Submitted → In review → Approved → Sent → Completed. Withdrawals over 1,000 XRP need two staff approvals. The XRP is reserved at submission and leaves the balance only when the ledger validates the transaction.

**Exchange (XRP to USD, manual)**

1. Enter how much XRP to sell. An estimate shows the USD received (about $1,176.60 for 500 XRP), the indicative rate, spread and fee, and the payout bank account.
2. **Submit request.** This isn't an instant swap: staff request a firm quote.
3. Accept the firm quote before it expires. Only then is the XRP reserved.
4. The payout goes to the verified bank account. A rejected request (for example, because the payout account isn't verified) reserves nothing and says why.

## 5. Earn, Borrow and Manage loan

The product screens show the risk and the exact effect of an action before the customer confirms it.

&#91;image: Earn, Borrow and Manage loan screens\]

**Earn (tab)**

- **Your position · XRP Flexible:** 1,500.00 XRP allocated since Sep 16. It shows rewards credited (1.89 XRP), confirmed by the provider but not yet paid, an estimated accrual (about 1.97 XRP), and a 30-day projection. Estimates are labelled as estimates.
- **Withdraw from XRP Flexible** opens a sheet: enter up to 1,500 XRP (or tap All), review the timing (1–2 business days), confirm, and see a confirmation message.
- **Products** lists XRP Flexible at a sample 3.00% variable APR, a 50 XRP minimum, no lock-up, and the provider name. Allocating more opens a sheet with the amount and a product-terms checkbox.

**Borrow (tab)**

- **Active loan LN-PROTO-0007:** $604.93 outstanding ($600 principal + $4.93 interest), status Healthy.
- The **loan-to-value meter** shows the current 33.9% against the margin call at 65% and liquidation at 80%.
- Details: 750 XRP collateral, margin-call and liquidation prices, 10% fixed APR, next interest due Nov 19. A price slider lets the customer try different XRP prices.
- **Add collateral** and **Repay** both open Manage loan. A new-loan estimate sits at the bottom.

**Manage loan**

1. Choose **Repay** or **Add collateral** at the top. The loan summary stays visible.
2. **Repay:** enter an amount or tap Interest $4.93, Half $302.47 or Full $604.93. Choose to pay by bank transfer or by selling XRP from the available balance. "Left to repay" and "LTV after" update as you type.
3. **Add collateral:** enter XRP (minimum 50, shortcuts +250 / +500 / +1,000). The collateral, LTV and liquidation price after the top-up update as you type.
4. **Review.** Adding collateral requires ticking an acknowledgement that the XRP can be sold at 80% LTV.
5. **Status timeline:** Request recorded → Awaiting payment (or Selling XRP / Sent to provider) → Confirmed → Applied. A bank repayment shows the payment details and reference. **Done** returns to Borrow.

## 6. Account: Profile, Security, Help & support, Legal, Custody

Profile is the hub for identity, protection, help and paperwork. Each row opens its own screen with a back arrow to Profile.

&#91;image: Profile, Security and Help & support screens\]

**Profile (tab):** name, account number and a Verified badge. Below that are quick Security toggles, a Security settings row, external (watch-only) wallets with **Disconnect**, and Appearance (Light / Dark). Rows for Notifications, Help & support, Legal and Custody sit further down, along with Sign out.

**Security**

- **Two-factor authentication:** turning it off shows a warning about a 24-hour hold, during which withdrawals pause.
- **Backup codes** (6 of 8 unused) opens a sheet with the codes and **Generate new codes**.
- **Password** opens a change-password sheet. Saving signs out every other device.
- **Withdrawal allowlist:** when on, withdrawals only go to saved addresses. Each address shows Active or "Activates in 6h" and can be removed. **Add address** opens a sheet (name, address, optional tag), and the new address activates after 24 hours.
- **Signed-in devices:** this device is labelled; others have **Sign out**. Recent security activity lists the latest events.

**Help & support**

- The safety banner says support only talks to you in the app and never asks for passwords, codes or recovery phrases.
- **Your requests** shows each ticket with its status. Tapping one expands the message thread, for example SUP-0921, a deposit sent without a tag.
- **Help topics** is a searchable list of answers that expand when tapped.
- **New request** opens a sheet: topic, an optional related transaction, and a message of at least 20 characters. The new ticket appears at the top with an automatic reply.

&#91;image: Legal & disclosures and Custody screens\]

**Legal & disclosures:** a banner says one document has changed. Documents are grouped into Account, Custody & payments and Products, each showing a version and a status (Accepted, Review update or For reference). Opening one shows its outline and your acceptance record. Fees and Charges v0.2 asks you to tick a checkbox and tap **Accept v0.2**, which clears the banner.

**Custody:** explains that assets are held with the custody provider in a sub-account. It shows the provider status, holdings broken down (available, yield, collateral, pending withdrawals) with the last reconciliation time, and supported assets by network. Controls link to the allowlist in Security, and documents link to Legal.

## 7. Admin console

Staff use a desktop console with seven pages in a black sidebar. What a person can do depends on their role: Operations, Compliance or Read-only Auditor. Every action is written to the audit log with the person's role.

### Overview

&#91;image: Admin Overview\]

Four cards: pending approvals, customer liabilities with their coverage by holdings, open reconciliation exceptions, and today's outflow against the daily limit. Below them, **Provider health** lists each provider's status (the yield provider shows Degraded), and **Needs attention** lists items to act on. Clicking any card or item opens its page with that item selected.

### Approval queue

&#91;image: Admin Approval queue\]

1. Filter by type (Withdrawals, Deposit exceptions, Exchange, Loans, Yield) and pick a request.
2. The detail panel shows the checks (balance reserved, screening, limits, 2FA, new destination), approvals so far, the ledger journal and the audit trail.
3. **Approve**, or **Reject…** with a reason and a note of at least 10 characters.
4. Rules: withdrawals over 1,000 XRP need two approvals from different roles, one of them Compliance. A role that may not act sees the button disabled with the reason. A rejection posts a reversing journal entry that releases the reserved funds.

### Transactions

&#91;image: Admin Transactions\]

Every customer movement, filterable by type. Selecting one shows its details, on-ledger evidence (hash and ledger index), journal and timeline. A pending item has **Open in approval queue**.

### Reconciliation

&#91;image: Admin Reconciliation\]

This page compares each wallet's balance in the internal ledger, at the custody provider, and on the XRP Ledger, and shows any difference. Liabilities are checked against holdings (100% covered). **Exceptions** lists what doesn't match:

- Unbooked network fees: Operations taps **Book fee adjustment**.
- A deposit without a tag: **Open in approval queue** to attribute it.
- A delayed provider confirmation: **Mark provider contacted**.

**Run now** starts a new run.

### Users

&#91;image: Admin Users\]

Search customers, then select one to see personal details, balances and flags. Personal details are masked by role: Compliance sees everything, Operations sees partial values, Auditors see masked values. Actions: **View transactions**, **Flag for review** (Operations), and **Freeze account** (Compliance only).

### Custody

&#91;image: Admin Custody\]

Shows the hot, warm and cold wallets with balances and signing rules, plus the signing policy, the list of signers, and limits with today's outflow bar. A **pending policy change** requested by Operations (raising the hot-wallet ceiling) can only be approved or declined by Compliance, and applies after 24 hours.

### Audit log

&#91;image: Admin Audit log\]

Every staff, customer and system event in time order, filterable by actor. Each entry stores a hash of the previous one, so editing or deleting any entry breaks the chain; the banner shows when the chain was last verified. **Export CSV** downloads the log, and the export itself is logged.
