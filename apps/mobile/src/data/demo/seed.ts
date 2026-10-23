import { toUnits, usdToMicro, xrpToDrops } from '@xrp/ledger';
import type {
  AllowlistAddress,
  AppNotification,
  Consent,
  CustomerProfile,
  Device,
  ExternalWallet,
  Loan,
  SecurityEvent,
  SupportTicket,
  Transaction,
  YieldPosition,
} from '@xrp/types';
import type { Holding, LegalDoc } from '../api';

/** The design's clock: Monday, Oct 19 2026, 12:50 WAT. The demo clock runs forward from here. */
export const DEMO_EPOCH = Date.parse('2026-10-19T11:50:00Z');
export const DEPOSIT_ADDRESS = 'rP9prototype0not0a0real0address';
export const EXTERNAL_WALLET = 'rExtXk3PaKcV9tYwZ2hNbQb7mproto9';

const w = (iso: string) => new Date(iso).toISOString(); // ISO in UTC; WAT = UTC+1

export const seedProfile: CustomerProfile = {
  id: '00000000-0000-4000-8000-000000000042',
  accountRef: 'ACC-PROTO-0042',
  fullName: 'Brendan Mebuge',
  displayName: 'Brendan M.',
  initials: 'BM',
  email: 'brendan@example.com',
  country: 'NG',
  currency: 'USD',
  kycStatus: 'verified',
  allowlistEnabled: false,
  passwordChangedAt: w('2026-07-20T08:00:00Z'),
  frozen: false,
};

export const seedBalances = {
  available: xrpToDrops('4170.10'),
  reserved: 0n,
  pendingYield: 0n,
  yield: xrpToDrops('1500'),
  collateral: xrpToDrops('750'),
};

/** Demo holdings across several assets (XRP keeps the design's numbers). */
export const seedHoldings: Holding[] = [
  { asset: 'XRP', ...seedBalances },
  { asset: 'BTC', available: toUnits('0.0425', 'BTC'), reserved: 0n, pendingYield: 0n, yield: toUnits('0.01', 'BTC'), collateral: 0n },
  { asset: 'ETH', available: toUnits('0.82', 'ETH'), reserved: 0n, pendingYield: 0n, yield: 0n, collateral: 0n },
  { asset: 'USDT', available: toUnits('1250', 'USDT'), reserved: 0n, pendingYield: 0n, yield: toUnits('500', 'USDT'), collateral: 0n },
  { asset: 'SOL', available: toUnits('12.5', 'SOL'), reserved: 0n, pendingYield: 0n, yield: 0n, collateral: 0n },
];

/** Demo deposit addresses for reported assets. Sample values: never send funds to them. */
export const DEMO_DEPOSIT_ADDRESSES: Record<string, string> = {
  BTC: 'bc1qdemo0address0do0not0send0funds0xyz9k',
  ETH: '0xDe00000000000000000000000000000000000001',
  USDT: 'TDemoAddressDoNotSendFundsXyz12345',
  USDC: '0xDe00000000000000000000000000000000000001',
  SOL: 'DemoSo1anaAddressDoNotSendFunds11111111111',
  BNB: '0xDe00000000000000000000000000000000000001',
};

export const PRICE = usdToMicro('2.38');

const ev = (toStatus: string, at: string, actor = 'System', note?: string) => ({
  fromStatus: null,
  toStatus: toStatus as never,
  at: w(at),
  actor,
  ...(note ? { note } : {}),
});

export const seedTransactions: Transaction[] = [
  {
    id: 'dep2041',
    ref: 'DEP-PROTO-2041',
    customerId: seedProfile.id,
    kind: 'deposit',
    asset: 'XRP',
    status: 'detected',
    amountDrops: xrpToDrops('1250'),
    createdAt: w('2026-10-19T10:42:00Z'),
    counterparty: 'rSendrXk3PaKcV9tYwZ2hNproto9Qa',
    destinationTag: '48201937',
    meta: {},
    events: [ev('detected', '2026-10-19T10:42:00Z', 'Monitor')],
  },
  {
    id: 'yld0098',
    ref: 'YLD-PROTO-0098',
    customerId: seedProfile.id,
    kind: 'yield_reward',
    asset: 'XRP',
    status: 'credited',
    amountDrops: xrpToDrops('2.10'),
    platformFeeDrops: xrpToDrops('0.21'),
    createdAt: w('2026-10-03T08:00:00Z'),
    meta: { product: 'XRP Flexible', period: 'Sep 16 – Oct 3' },
    events: [
      ev('statement_received', '2026-10-02T23:02:00Z', '[Yield provider]'),
      ev('matched', '2026-10-03T07:12:00Z'),
      ev('credited', '2026-10-03T08:00:00Z'),
    ],
  },
  {
    id: 'wd1988',
    ref: 'WD-PROTO-1988',
    customerId: seedProfile.id,
    kind: 'withdrawal',
    asset: 'XRP',
    status: 'validated',
    amountDrops: xrpToDrops('300'),
    platformFeeDrops: xrpToDrops('0.25'),
    networkFeeDrops: 12n,
    createdAt: w('2026-10-12T14:21:00Z'),
    counterparty: 'rRecipXk3PaKcV9tYwZ2hNproto7Hd',
    destinationTag: '10293847',
    ledgerHash: '3F9C8E1D2A7B4C6E9F0A1B2C3D4E5F60718293A4B5C6D7E8F9PROTO',
    ledgerIndex: 92301447,
    meta: {},
    events: [
      ev('requested', '2026-10-12T14:21:00Z', 'Customer', '2FA verified'),
      ev('in_review', '2026-10-12T14:40:00Z'),
      ev('approved', '2026-10-12T14:52:00Z', 'A. Bello (Operations)'),
      ev('submitted', '2026-10-12T15:02:00Z', '[Custody provider]'),
      ev('validated', '2026-10-12T15:08:00Z', 'XRPL worker'),
    ],
  },
  {
    id: 'ex0301',
    ref: 'EX-PROTO-0301',
    customerId: seedProfile.id,
    kind: 'exchange',
    asset: 'XRP',
    status: 'rejected',
    amountDrops: xrpToDrops('500'),
    createdAt: w('2026-10-09T09:15:00Z'),
    meta: { reason: 'Payout account not yet verified', indicative_cents: '117504', reviewed_at: w('2026-10-09T09:31:00Z') },
    events: [
      ev('requested', '2026-10-09T09:15:00Z', 'Customer'),
      ev('rejected', '2026-10-09T10:02:00Z', 'A. Bello (Operations)', 'Payout account not yet verified'),
    ],
  },
  {
    id: 'ln0007',
    ref: 'LN-PROTO-0007',
    customerId: seedProfile.id,
    kind: 'loan',
    asset: 'XRP',
    status: 'active',
    amountDrops: xrpToDrops('750'),
    amountCents: 60_000n,
    createdAt: w('2026-09-18T16:40:00Z'),
    meta: { starting_ltv: '33.6%', interest: '10.00% APR · fixed', origination_fee: '$6.00', paid_to: '[Bank account •••• 0000]' },
    events: [
      ev('applied', '2026-09-18T16:40:00Z', 'Customer'),
      ev('approved', '2026-09-19T09:05:00Z', 'K. Musa (Compliance)'),
      ev('collateral_locked', '2026-09-19T09:06:00Z'),
      ev('funded', '2026-09-19T13:30:00Z', '[Lending provider]'),
      ev('active', '2026-09-19T13:30:00Z'),
    ],
  },
  {
    id: 'dep1650',
    ref: 'DEP-PROTO-1650',
    customerId: seedProfile.id,
    kind: 'deposit',
    asset: 'XRP',
    status: 'credited',
    amountDrops: xrpToDrops('2000'),
    createdAt: w('2026-09-21T07:47:00Z'),
    counterparty: EXTERNAL_WALLET,
    destinationTag: '48201937',
    ledgerHash: '9A1D44C2B8E07F3A6D5C9B1E2F8A7D3C4B6E5F1A2PROTO',
    meta: {},
    events: [
      ev('detected', '2026-09-21T07:47:00Z', 'Monitor'),
      ev('validated', '2026-09-21T07:47:00Z'),
      ev('screened', '2026-09-21T07:49:00Z', '[Screening provider]'),
      ev('credited', '2026-09-21T07:49:00Z'),
    ],
  },
  {
    id: 'dep2052',
    ref: 'DEP-PROTO-2052',
    customerId: seedProfile.id,
    kind: 'deposit',
    asset: 'USDT',
    status: 'reported',
    amountDrops: toUnits('500', 'USDT'),
    createdAt: w('2026-10-19T09:58:00Z'),
    counterparty: 'TSendrProtoAddressXyz1234567890ab',
    meta: { tx_hash: 'a3f1c9e07b52d4e8f6a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2', reported_by: 'customer' },
    events: [ev('reported', '2026-10-19T09:58:00Z', 'Customer')],
  },
  {
    id: 'dep2031',
    ref: 'DEP-PROTO-2031',
    customerId: seedProfile.id,
    kind: 'deposit',
    asset: 'BTC',
    status: 'credited',
    amountDrops: toUnits('0.0525', 'BTC'),
    createdAt: w('2026-10-14T16:05:00Z'),
    counterparty: 'bc1qsendrprotoxk3pakcv9tywz2hnproto9qa',
    meta: { tx_hash: 'b6f6991d03df0e2e04dafffcd6bc418aac66049e2cd74b80f14ac86db1e3f0da', reported_by: 'customer' },
    events: [
      ev('reported', '2026-10-14T16:05:00Z', 'Customer'),
      ev('validated', '2026-10-14T17:20:00Z', 'A. Bello (Operations)', 'Confirmed on the network by staff'),
      ev('screened', '2026-10-14T17:20:00Z', 'A. Bello (Operations)'),
      ev('credited', '2026-10-14T17:20:00Z', 'A. Bello (Operations)'),
    ],
  },
];

export const seedLoan: Loan = {
  id: 'ln0007',
  ref: 'LN-PROTO-0007',
  principalCents: 60_000n,
  interestCents: 493n,
  aprBps: 1000,
  collateralDrops: xrpToDrops('750'),
  marginBps: 6500,
  liquidationBps: 8000,
  status: 'active',
  fundedAt: w('2026-09-19T13:30:00Z'),
  nextInterestDue: w('2026-11-19T00:00:00Z'),
  originationFeeCents: 600n,
  collateralAsset: 'XRP',
};

export const seedYield: YieldPosition = {
  product: 'xrp_flexible',
  asset: 'XRP',
  allocatedDrops: xrpToDrops('1500'),
  aprBps: 300,
  feeBps: 1000,
  since: w('2026-09-16T07:02:00Z'),
  creditedDrops: xrpToDrops('1.89'),
  confirmedUnpaidDrops: 0n,
  estimatedAccruedDrops: xrpToDrops('1.97'),
};

export const seedYieldPositions: YieldPosition[] = [
  seedYield,
  {
    product: 'btc_flexible',
    asset: 'BTC',
    allocatedDrops: toUnits('0.01', 'BTC'),
    aprBps: 150,
    feeBps: 1000,
    since: w('2026-10-01T09:00:00Z'),
    creditedDrops: 0n,
    confirmedUnpaidDrops: 0n,
    estimatedAccruedDrops: 740n,
  },
  {
    product: 'usdt_flexible',
    asset: 'USDT',
    allocatedDrops: toUnits('500', 'USDT'),
    aprBps: 600,
    feeBps: 1000,
    since: w('2026-10-05T09:00:00Z'),
    creditedDrops: 0n,
    confirmedUnpaidDrops: 0n,
    estimatedAccruedDrops: toUnits('1.15', 'USDT'),
  },
];

export const seedNotifications: AppNotification[] = [
  {
    id: 'n1',
    type: 'tx',
    tone: 'warn',
    icon: 'recv',
    title: 'Deposit detected',
    body: '1,250.00 XRP is waiting for ledger validation. It’s not in your balance yet.',
    createdAt: w('2026-10-19T10:42:00Z'),
    link: '/',
    readAt: null,
  },
  {
    id: 'n2',
    type: 'security',
    tone: '',
    icon: 'shield',
    title: 'New sign-in',
    body: 'Chrome on macOS · Lagos. Not you? Revoke the session and change your password.',
    createdAt: w('2026-10-19T08:14:00Z'),
    link: '/security',
    readAt: null,
  },
  {
    id: 'n3',
    type: 'tx',
    tone: '',
    icon: 'clock',
    title: 'Interest due soon',
    body: 'Your loan LN-PROTO-0007 has $4.93 interest due on Nov 19.',
    createdAt: w('2026-10-18T08:00:00Z'),
    link: '/loan/manage',
    readAt: w('2026-10-18T09:00:00Z'),
  },
  {
    id: 'n4',
    type: 'tx',
    tone: 'bad',
    icon: 'ex',
    title: 'Exchange request rejected',
    body: 'EX-PROTO-0301 was rejected: payout account not yet verified. No XRP was reserved.',
    createdAt: w('2026-10-09T10:02:00Z'),
    link: '/',
    readAt: w('2026-10-09T11:00:00Z'),
  },
  {
    id: 'n5',
    type: 'tx',
    tone: 'ok',
    icon: 'coin',
    title: 'Yield reward credited',
    body: '1.89 XRP from XRP Flexible is now in your available balance.',
    createdAt: w('2026-10-03T08:00:00Z'),
    link: '/earn',
    readAt: w('2026-10-03T09:00:00Z'),
  },
  {
    id: 'n6',
    type: 'security',
    tone: 'warn',
    icon: 'alert',
    title: 'Collateral alert settings',
    body: 'We’ll alert you if your loan’s LTV passes 55%, and again at the 65% margin call.',
    createdAt: w('2026-09-19T13:30:00Z'),
    link: '/borrow',
    readAt: w('2026-09-19T14:00:00Z'),
  },
  {
    id: 'n7',
    type: 'account',
    tone: '',
    icon: 'doc',
    title: 'Terms updated',
    body: 'Fees and Charges draft v0.2 is available to review.',
    createdAt: w('2026-09-02T09:00:00Z'),
    link: '/legal',
    readAt: w('2026-09-02T10:00:00Z'),
  },
];

export const seedAllowlist: AllowlistAddress[] = [
  { id: 'a1', asset: 'XRP', label: 'Hardware wallet', address: 'rHwProtoWa11et9xQb7mKcV9tYwZ2A', tag: null, activeFrom: w('2026-09-10T08:00:00Z') },
  {
    id: 'a2',
    asset: 'XRP',
    label: 'Exchange account',
    address: 'rExchProtoDeposit4xQb7mKcV9tY',
    tag: '10293847',
    activeFrom: new Date(DEMO_EPOCH + 6 * 3600_000).toISOString(),
  },
];

export const seedDevices: Device[] = [
  { id: 'd1', name: 'iPhone 15 · XRP Ledger app', location: 'Lagos', lastActive: new Date(DEMO_EPOCH).toISOString(), kind: 'phone', current: true },
  { id: 'd2', name: 'Chrome on macOS', location: 'Lagos', lastActive: w('2026-10-19T08:14:00Z'), kind: 'laptop', current: false },
];

export const seedSecurityEvents: SecurityEvent[] = [
  { id: 's1', title: 'New sign-in · Chrome on macOS', meta: 'Today 09:14 · Lagos', at: w('2026-10-19T08:14:00Z') },
  { id: 's2', title: 'Allowlist address added', meta: 'Oct 18 · Exchange account', at: w('2026-10-18T11:00:00Z') },
  { id: 's3', title: 'Two-factor turned on', meta: 'Sep 2 · iPhone 15', at: w('2026-09-02T09:25:00Z') },
  { id: 's4', title: 'Account created', meta: 'Sep 2', at: w('2026-09-02T09:14:00Z') },
];

export const seedTickets: SupportTicket[] = [
  {
    ref: 'SUP-0921',
    subject: 'Deposit sent without destination tag',
    topic: 'Deposit',
    transactionRef: null,
    createdAt: w('2026-10-19T11:05:00Z'),
    status: 'waiting_on_us',
    messages: [
      { from: 'me', text: 'I sent 500 XRP from my exchange and forgot the tag. Transaction attached.', meta: 'You · 12:05' },
      {
        from: 'them',
        text: 'Thanks — we’ve found the deposit and it’s held safely. Our operations team is confirming it’s yours; we’ll update you here.',
        meta: 'Support · 12:10',
      },
    ],
  },
];

export const seedExternalWallets: ExternalWallet[] = [{ address: EXTERNAL_WALLET, access: 'watch', balanceDrops: xrpToDrops('312.40') }];

export const legalDocs: LegalDoc[] = [
  {
    id: 'tos',
    group: 'Account',
    name: 'Terms of Service',
    version: 'v0.1',
    requiresAcceptance: true,
    changeSummary: null,
    sections: [
      ['1. About these Terms', 'These Terms of Service (the “Terms”) form a binding agreement between you and [Company name], a company registered in [Jurisdiction] under number [Registration number], with its registered office at [Registered address] (“we”, “us”, “our”). They govern your use of the XRP Ledger app, website and related services (the “Services”).\n\nThese Terms apply together with our Privacy Policy, Digital Asset Risk Disclosure, Custody Agreement, Deposit and Withdrawal Policy, Fees and Charges, and any product terms you accept (for example the Yield Product Terms or the Lending and Collateral Agreement). If a product’s terms conflict with these Terms, the product terms apply to that product.\n\nBy creating an account or using the Services you confirm that you have read, understood and accept these Terms. If you do not agree, do not use the Services.'],
      ['2. Eligibility', 'To open an account you must: (a) be at least 18 years old and have full legal capacity; (b) be resident in a country where we offer the Services; (c) not be a person subject to sanctions, or resident in a sanctioned or restricted territory; and (d) open the account for yourself, not on behalf of anyone else. You may hold only one personal account. We may refuse an application at our discretion, and we are not required to give a reason where the law prevents us from doing so.'],
      ['3. Identity verification', 'We are required by law to verify who you are before you can deposit, earn or borrow, and to keep that information up to date. You agree to provide accurate, complete information and documents when asked, including during periodic reviews. We use [KYC provider] to carry out these checks. We may limit, suspend or close your account if you do not complete verification or if information you provided is false or out of date.'],
      ['4. Your account and security', 'You are responsible for keeping your sign-in details, devices and two-factor authentication methods secure, and for all activity on your account that happens with them. Tell us immediately through Help & support if you believe your account has been accessed without your permission.\n\nYour custodial account has no recovery phrase. We will never ask for your password, one-time codes or the recovery phrase of any wallet, by phone, email, chat or in the app. Anyone who asks for them is attempting fraud, and you should report it to us.'],
      ['5. Custody of your assets', 'Digital assets you deposit are held on your behalf through our custody provider, [Custody provider], in accounts segregated from our own corporate assets. Private keys are generated and kept within the custody provider’s security environment and are never stored on your device.\n\nYour balance in the app reflects our internal ledger of what we hold for you, which we reconcile against the custody provider’s records daily. Assets are not deposits with a bank and are not covered by any deposit-guarantee or investor-compensation scheme unless we expressly say otherwise. Full details are in the Custody Agreement.'],
      ['6. Deposits', 'Each account is assigned a deposit address and a unique destination tag. Deposits must be sent on the supported network, to the address shown, with your destination tag. A deposit is credited to your available balance once it has been validated on the ledger and passed our screening checks. Deposits sent to the wrong network, without the correct tag, or in an unsupported asset may be delayed, may incur a recovery fee, or may be unrecoverable.'],
      ['7. Withdrawals', 'You may withdraw available assets to an external address you control. Withdrawals are reviewed before they are sent, may be subject to daily limits and address allowlisting, and are not instant. We may delay or refuse a withdrawal where we reasonably need to verify it, where the law requires it, or where we suspect fraud. Once a withdrawal has been broadcast to the ledger it cannot be reversed, so you are responsible for checking the address and destination tag.'],
      ['8. Exchange', 'Where we offer conversion between digital assets and fiat currency, you will see the rate, spread and any fees before you accept a quote. Quotes are valid for the time shown. An accepted exchange is final once completed, and payouts are made only to a verified bank account in your own name.'],
      ['9. Yield products', 'You may choose to allocate assets to yield products offered through third-party providers. Rates are set by the provider, are variable unless stated otherwise, and are not guaranteed. Any figures shown in the app before rewards are confirmed, including live accrual counters and projections, are estimates only. Rewards are credited only once confirmed by the provider, after our platform fee. Allocated assets are exposed to the provider’s risk, including its failure. The Yield Product Terms apply.'],
      ['10. Borrowing', 'Where available, you may borrow against digital assets you hold with us as collateral. Before you apply you will see the loan-to-value (LTV) ratio, interest rate, fees, margin-call level and liquidation level. If the value of your collateral falls so that your LTV reaches the liquidation level, we may sell some or all of your collateral without further notice to repay the loan, and you remain liable for any shortfall. The Lending and Collateral Agreement applies.'],
      ['11. Fees', 'Our fees are set out in Fees and Charges and are shown in the app before you confirm a transaction. We may deduct fees from your balance. We will give you at least 30 days’ notice of any increase to an existing fee, unless the change is required by law or reflects network fees outside our control.'],
      ['12. Prohibited use', 'You must not use the Services: to break any law or sanctions; to launder money or finance terrorism; for fraud, market manipulation or to deceive others; with funds that are proceeds of crime; on behalf of another person without our consent; to interfere with, reverse-engineer or attack the Services; or by creating accounts with false or stolen identities. We may report suspicious activity to the relevant authorities without telling you.'],
      ['13. Monitoring and records', 'To protect customers and meet our legal obligations, we record and monitor account activity, including sign-ins, device and approximate location (country and city derived from IP address), changes to your details, and transactions. Authorised staff can view this information under strict access controls, and every access is logged. We keep records for the periods required by law. Our Privacy Policy explains how we use and protect your information.'],
      ['14. Suspension and restrictions', 'We may suspend, restrict or freeze your account, or any transaction, where: we are required to by law or a competent authority; we reasonably suspect fraud, unauthorised access or a breach of these Terms; you have not completed verification; or there is a dispute about ownership of the assets. Where the law allows, we will tell you and explain what you need to do.'],
      ['15. Closing your account', 'You may close your account at any time through Help & support, after repaying any outstanding loans and withdrawing your assets. We may close your account on 60 days’ notice, or immediately in the circumstances described in section 14. When an account is closed we will return remaining assets to a verified external address or bank account in your name, less any amounts you owe us, unless the law prevents us from doing so.'],
      ['16. Risks', 'Digital assets are volatile and can lose some or all of their value quickly. Past performance and estimated returns are not a guide to future results. You rely on us and our providers remaining solvent, secure and available, and on the underlying networks operating as expected. Please read the Digital Asset Risk Disclosure before depositing. Nothing in the Services is investment, legal or tax advice, and you are responsible for any taxes due on your activity.'],
      ['17. Our liability', 'We will provide the Services with reasonable skill and care. We are not liable for: losses caused by your breach of these Terms or failure to keep your account secure; changes in the market value of digital assets; delays or failures of third-party networks or providers outside our reasonable control; or indirect or consequential loss. Our total liability to you in connection with the Services is limited to the greater of the fees you paid us in the 12 months before the claim and [Liability cap amount]. Nothing in these Terms limits liability for fraud, death or personal injury caused by negligence, or any liability that cannot be limited by law.'],
      ['18. Intellectual property', 'The Services, including the software, design and content, belong to us or our licensors. We grant you a personal, non-transferable licence to use the app for your own account while these Terms apply. XRP Ledger is used descriptively; we are not affiliated with Ripple Labs or the XRP Ledger Foundation.'],
      ['19. Changes to these Terms', 'We may update these Terms to reflect changes in the law, our providers or the Services. We will give you at least 30 days’ notice of material changes in the app or by email, and ask you to accept them where required. If you do not accept a change, you may close your account before it takes effect without charge.'],
      ['20. Complaints, governing law and contact', 'If you are unhappy with the Services, please contact us through Help & support; our Complaints and Disputes policy explains how we handle complaints and when you may escalate to an external body. These Terms are governed by the laws of [Governing law], and the courts of [Jurisdiction] have jurisdiction, without affecting any mandatory consumer rights you have where you live.\n\nContact: [Company name], [Registered address], [Support email].'],
    ],
  },
  {
    id: 'privacy',
    group: 'Account',
    name: 'Privacy Policy',
    version: 'v0.1',
    requiresAcceptance: true,
    changeSummary: null,
    sections: [
      ['What we collect', 'Identity, contact, device and transaction data — and why each is needed.'],
      ['Who we share it with', '[KYC provider], [Custody provider] and others, listed by purpose.'],
      ['Your rights', 'Access, correction and deletion, subject to record-keeping law.'],
    ],
  },
  {
    id: 'risk',
    group: 'Account',
    name: 'Digital Asset Risk Disclosure',
    version: 'v0.1',
    requiresAcceptance: true,
    changeSummary: null,
    sections: [
      ['Price risk', 'XRP can lose value quickly, including all of it.'],
      ['Custodial risk', 'You rely on the platform and its providers remaining solvent and available.'],
      ['No guarantees', 'No deposit insurance or guaranteed returns unless stated in a specific product.'],
    ],
  },
  {
    id: 'custody',
    group: 'Custody & payments',
    name: 'Custody Agreement',
    version: 'v0.1',
    requiresAcceptance: true,
    changeSummary: null,
    sections: [
      ['How assets are held', 'Through [Custody provider]; keys stay in the provider’s security boundary.'],
      ['Records and reconciliation', 'Our internal ledger, how it’s reconciled with the provider, and your statements.'],
      ['If something goes wrong', 'Outages, insolvency and how claims are handled.'],
    ],
  },
  {
    id: 'deposits',
    group: 'Custody & payments',
    name: 'Deposit and Withdrawal Policy',
    version: 'v0.1',
    requiresAcceptance: true,
    changeSummary: null,
    sections: [
      ['Supported networks', 'Which assets and networks are accepted, and destination tag rules.'],
      ['Review and limits', 'Why withdrawals are reviewed, approval thresholds and daily limits.'],
      ['Mistakes', 'What happens with wrong networks, missing tags or unsupported tokens.'],
    ],
  },
  {
    id: 'fees',
    group: 'Custody & payments',
    name: 'Fees and Charges',
    version: 'v0.2',
    requiresAcceptance: true,
    changeSummary: 'The exchange spread is now shown as a single percentage, and the bank payout fee is listed separately.',
    sections: [
      ['Deposits and withdrawals', 'Deposits are free; withdrawals cost 0.25 XRP plus the network fee.'],
      ['Exchange', 'Spread and payout fee, shown before you accept a quote.'],
      ['Products', 'Yield platform fee and loan interest and origination fees.'],
    ],
  },
  {
    id: 'yield',
    group: 'Products',
    name: 'Yield Product Terms',
    version: 'v0.1',
    requiresAcceptance: true,
    changeSummary: null,
    sections: [
      ['How rewards work', 'Rate source, accrual, confirmation and when rewards are credited.'],
      ['Withdrawing', 'Notice periods and provider-dependent delays.'],
      ['Risks', 'Provider failure and variable rates.'],
    ],
  },
  {
    id: 'lending',
    group: 'Products',
    name: 'Lending and Collateral Agreement',
    version: 'v0.1',
    requiresAcceptance: true,
    changeSummary: null,
    sections: [
      ['Collateral', 'Loan-to-value, margin calls and liquidation at 80%.'],
      ['Interest and repayment', 'Rate type, schedule and early repayment.'],
      ['Liquidation', 'How collateral is sold and any shortfall is handled.'],
    ],
  },
  {
    id: 'complaints',
    group: 'Products',
    name: 'Complaints and Disputes',
    version: 'v0.1',
    requiresAcceptance: false,
    changeSummary: null,
    sections: [
      ['How to complain', 'Through Help & support, with a reference number.'],
      ['Response times', 'When we acknowledge and resolve complaints.'],
      ['Escalation', 'External bodies you can contact, depending on jurisdiction.'],
    ],
  },
];

export const seedConsents: Consent[] = [
  { document: 'tos', version: 'v0.1', acceptedAt: w('2026-09-02T09:14:00Z'), surface: 'Sign-up', consentId: 'CNS-PROTO-0001' },
  { document: 'privacy', version: 'v0.1', acceptedAt: w('2026-09-02T09:14:00Z'), surface: 'Sign-up', consentId: 'CNS-PROTO-0002' },
  { document: 'risk', version: 'v0.1', acceptedAt: w('2026-09-02T09:14:00Z'), surface: 'Sign-up', consentId: 'CNS-PROTO-0003' },
  { document: 'custody', version: 'v0.1', acceptedAt: w('2026-09-02T09:20:00Z'), surface: 'Account setup', consentId: 'CNS-PROTO-0004' },
  { document: 'deposits', version: 'v0.1', acceptedAt: w('2026-09-02T09:20:00Z'), surface: 'Account setup', consentId: 'CNS-PROTO-0005' },
  { document: 'fees', version: 'v0.1', acceptedAt: w('2026-09-02T09:20:00Z'), surface: 'Account setup', consentId: 'CNS-PROTO-0006' },
  { document: 'yield', version: 'v0.1', acceptedAt: w('2026-09-16T07:02:00Z'), surface: 'Earn · XRP Flexible', consentId: 'CNS-PROTO-0007' },
  { document: 'lending', version: 'v0.1', acceptedAt: w('2026-09-18T16:40:00Z'), surface: 'Borrow · LN-PROTO-0007', consentId: 'CNS-PROTO-0008' },
];
