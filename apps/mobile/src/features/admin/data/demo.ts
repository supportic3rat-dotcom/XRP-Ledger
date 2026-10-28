import { ASSETS, asset as assetSpec, formatAmount, isAssetAddress, toUnits, unitsToCents } from '@xrp/ledger';
import { hm } from './format';
import { livePrices } from './prices';
import { maskPersonal } from './mask';
import { approveBlock } from './rules';
import { queueStatus } from './status';
import type {
  AdminData,
  AssetRow,
  AuditRow,
  CheckTone,
  Custody,
  CustomerRecord,
  Decision,
  HoldingRow,
  IdentityCheck,
  QueueItem,
  Recon,
  Role,
  Staff,
  TxItem,
} from './types';
import { ROLES } from './types';

/**
 * Demo data: the design's sample data and rules (roles, separation of duties, outcomes), held in memory on the
 * phone. Used until EXPO_PUBLIC_SUPABASE_URL is set. The real rules live in SQL and Edge Functions.
 */

const X = (xrp: string): bigint => {
  const [w = '0', f = ''] = xrp.replace(/,/g, '').split('.');
  return BigInt(w) * 1_000_000n + BigInt((f + '000000').slice(0, 6));
};

/** The demo clock starts at 12:50 WAT on Oct 19, 2026, like the design, and runs from app start. */
const EPOCH = Date.parse('2026-10-19T11:50:00Z');
const started = Date.now();
const now = () => new Date(EPOCH + (Date.now() - started));

const STAFF: Record<Role, Staff> = {
  operations: { id: '00000000-0000-4000-9000-00000000a001', name: 'A. Bello', role: 'operations' },
  compliance: { id: '00000000-0000-4000-9000-00000000c002', name: 'K. Musa', role: 'compliance' },
  auditor: { id: '00000000-0000-4000-9000-00000000d001', name: 'Auditor', role: 'auditor' },
};
const J_DURU = '00000000-0000-4000-9000-00000000c001';

const check = (label: string, note: string, tone: CheckTone) => ({ label, note, tone });
const j = (account: string, dr: string, cr: string) => ({ account, dr, cr });
const t = (at: string, text: string) => ({ at, text });

const initialQueue = (): QueueItem[] => [
  {
    id: 'dep2052',
    ref: 'DEP-PROTO-2052',
    customer: 'CUS-0042',
    kind: 'deposit',
    type: 'Deposit confirmation · USDT',
    amount: '500.00 USDT',
    age: '52m',
    summary: 'Reported by customer · hash a3f1c9e07b…c0d1e2 · confirm on Tron (TRC-20) before approving',
    checks: [
      check('Reported by customer', '500.00 USDT · hash a3f1c9e07b52…', 'wait'),
      check('Confirm on Tron (TRC-20)', 'Amount, confirmations and receiving address TDemoAddre…', 'wait'),
      check('Source screened', '[Screening provider] · low risk', 'ok'),
    ],
    required: 1,
    approvals: [],
    journal: [],
    audit: [t('11:58', 'Customer reported deposit of 500.00 USDT')],
    decided: null,
    requestedBy: null,
    claimant: null,
  },
  {
    id: 'wd2042',
    ref: 'WD-PROTO-2042',
    customer: 'CUS-0042',
    kind: 'withdrawal',
    type: 'Withdrawal',
    amount: '1,250.00 XRP',
    age: '22m',
    summary: 'To rProtoRecipient4xQb…2hN · tag 10293847 · XRP Ledger',
    checks: [
      check('Balance reserved', 'Ledger hold posted at 12:30', 'ok'),
      check('Destination screening', '[Screening provider]: low risk', 'ok'),
      check('Within daily limit', '1,250 of 25,000 XRP', 'ok'),
      check('Confirmed by customer', 'Face ID on device, 12:30', 'ok'),
      check('New destination', 'First withdrawal to this address', 'warn'),
    ],
    required: 2,
    approvals: [{ who: 'J. Duru', at: '12:41', role: 'compliance', staffId: J_DURU }],
    journal: [j('Customer available · XRP', '1,250.00', ''), j('Customer reserved · XRP', '', '1,250.00')],
    audit: [
      t('12:30', 'Customer submitted request (confirmed on device)'),
      t('12:30', 'System reserved 1,250.00 XRP'),
      t('12:41', 'J. Duru (Compliance) approved · 1 of 2'),
    ],
    decided: null,
    requestedBy: null,
    claimant: null,
  },
  {
    id: 'wd2043',
    ref: 'WD-PROTO-2043',
    customer: 'CUS-0187',
    kind: 'withdrawal',
    type: 'Withdrawal',
    amount: '80.00 XRP',
    age: '8m',
    summary: 'To saved allowlisted address · XRP Ledger',
    checks: [
      check('Balance reserved', 'Ledger hold posted at 12:44', 'ok'),
      check('Destination screening', 'Low risk', 'ok'),
      check('Allowlisted address', 'Saved 41 days ago', 'ok'),
    ],
    required: 1,
    approvals: [],
    journal: [j('Customer available · XRP', '80.00', ''), j('Customer reserved · XRP', '', '80.00')],
    audit: [t('12:44', 'Customer submitted request (confirmed on device)'), t('12:44', 'System reserved 80.00 XRP')],
    decided: null,
    requestedBy: null,
    claimant: null,
  },
  {
    id: 'dep2050',
    ref: 'DEP-PROTO-2050',
    customer: 'Unattributed',
    kind: 'deposit',
    type: 'Deposit exception',
    amount: '500.00 XRP',
    age: '1h 05m',
    summary: 'Validated on ledger · no destination tag · sender rSendr…k3P',
    checks: [
      check('Validated on ledger', 'Tx hash recorded from validated ledger', 'ok'),
      check('Destination tag', 'Missing — cannot auto-attribute', 'warn'),
      check('Customer claim', 'CUS-0311 opened ticket SUP-0921 with tx proof', 'wait'),
    ],
    required: 1,
    approvals: [],
    journal: [j('Custody omnibus · XRP', '500.00', ''), j('Unattributed deposits · XRP', '', '500.00')],
    audit: [
      t('11:47', 'Monitor detected deposit without tag'),
      t('11:47', 'Posted to unattributed deposits (suspense)'),
      t('12:10', 'Support linked ticket SUP-0921'),
    ],
    decided: null,
    requestedBy: null,
    claimant: 'CUS-0311',
  },
  {
    id: 'ex0318',
    ref: 'EX-PROTO-0318',
    customer: 'CUS-0042',
    kind: 'exchange',
    type: 'Exchange · XRP → USD',
    amount: '500.00 XRP',
    age: '14m',
    summary: 'Manual request · needs firm quote from [Liquidity provider]',
    checks: [check('Customer eligible', 'Verified, within exchange limits', 'ok'), check('Liquidity provider quote', 'Not requested yet', 'wait')],
    required: 1,
    approvals: [],
    journal: [],
    audit: [t('12:38', 'Customer submitted request (indicative $1,175.04)')],
    decided: null,
    requestedBy: null,
    claimant: null,
  },
  {
    id: 'ln0009',
    ref: 'LN-PROTO-0009',
    customer: 'CUS-0098',
    kind: 'loan',
    type: 'Loan application',
    amount: '$1,500.00',
    age: '3h',
    summary: '2,000.00 XRP collateral · starting LTV 31.5% · [Lending provider]',
    checks: [
      check('Identity verified', 'Verified Sep 2', 'ok'),
      check('Collateral available', '2,000.00 XRP free', 'ok'),
      check('Agreement accepted', 'Lending Agreement draft v0.1 at 09:52', 'ok'),
      check('Provider credit decision', 'Pending', 'wait'),
    ],
    required: 1,
    approvals: [],
    journal: [],
    audit: [t('09:52', 'Customer submitted application')],
    decided: null,
    requestedBy: null,
    claimant: null,
  },
  {
    id: 'yd0112',
    ref: 'YLD-PROTO-0112',
    customer: 'CUS-0233',
    kind: 'yield',
    type: 'Yield allocation',
    amount: '300.00 XRP',
    age: '41m',
    summary: 'XRP Flexible · [Yield provider]',
    checks: [check('Product terms accepted', 'Yield Product Terms draft v0.1', 'ok'), check('Above minimum', '300 ≥ 50 XRP', 'ok')],
    required: 1,
    approvals: [],
    journal: [j('Customer available · XRP', '300.00', ''), j('Customer pending yield · XRP', '', '300.00')],
    audit: [t('12:11', 'Customer submitted allocation')],
    decided: null,
    requestedBy: null,
    claimant: null,
  },
];

const r = (k: string, v: string, mono = false) => ({ k, v, ...(mono ? { mono } : {}) });
type TxSeed = Omit<TxItem, 'asset' | 'manualSend' | 'settle'> & Partial<Pick<TxItem, 'asset' | 'manualSend' | 'settle'>>;
const TX_SEED: TxSeed[] = [
  {
    id: 't1',
    ref: 'DEP-PROTO-2041',
    customer: 'CUS-0042',
    kind: 'deposit',
    type: 'Deposit',
    amount: '+1,250.00 XRP',
    time: 'Today 11:42',
    status: 'Validating',
    tone: 'wait',
    queueId: null,
    rows: [r('From', 'rSendr…proto9Qa', true), r('Destination tag', '48201937', true), r('Screening', 'Passed · low risk'), r('Ledger', 'Awaiting validation')],
    journal: [],
    timeline: [
      t('11:42', 'Monitor detected incoming payment'),
      t('11:42', 'Matched to CUS-0042 by tag'),
      t('11:42', 'Screening passed · waiting for validated ledger'),
    ],
  },
  {
    id: 't2',
    ref: 'WD-PROTO-2042',
    customer: 'CUS-0042',
    kind: 'withdrawal',
    type: 'Withdrawal',
    amount: '−1,250.00 XRP',
    time: 'Today 12:30',
    status: 'Awaiting approval',
    tone: 'wait',
    queueId: 'wd2042',
    rows: [r('To', 'rProtoRecipient4xQb…2hN', true), r('Destination tag', '10293847', true), r('Fee', '0.25 XRP + network'), r('Approvals', '1 of 2')],
    journal: [j('Customer available · XRP', '1,250.00', ''), j('Customer reserved · XRP', '', '1,250.00')],
    timeline: [
      t('12:30', 'Customer submitted (confirmed on device)'),
      t('12:30', 'System reserved 1,250.00 XRP'),
      t('12:41', 'J. Duru (Compliance) approved · 1 of 2'),
    ],
  },
  {
    id: 't3',
    ref: 'WD-PROTO-1988',
    customer: 'CUS-0042',
    kind: 'withdrawal',
    type: 'Withdrawal',
    amount: '−300.00 XRP',
    time: 'Oct 12 16:20',
    status: 'Completed',
    tone: 'ok',
    queueId: null,
    rows: [
      r('To', 'rRecip…proto7Hd', true),
      r('Destination tag', '10293847', true),
      r('Fees', '0.250012 XRP'),
      r('Ledger hash', '3F9C…PROTO', true),
      r('Ledger index', '92,301,447', true),
    ],
    journal: [j('Customer reserved · XRP', '300.25', ''), j('Custody omnibus · XRP', '', '300.000012'), j('Fee revenue · XRP', '', '0.249988')],
    timeline: [
      t('16:02', 'Customer submitted'),
      t('16:09', 'A. Bello (Operations) approved'),
      t('16:11', 'Submitted to [Custody provider]'),
      t('16:11', 'Validated on ledger · marked Completed'),
    ],
  },
  {
    id: 't4',
    ref: 'EX-PROTO-0301',
    customer: 'CUS-0042',
    kind: 'exchange',
    type: 'Exchange · XRP → USD',
    amount: '500.00 XRP',
    time: 'Oct 9 10:05',
    status: 'Rejected',
    tone: 'bad',
    queueId: null,
    rows: [r('Reason', 'Payout account not verified'), r('Quote', 'Never requested'), r('Fees charged', 'None')],
    journal: [],
    timeline: [
      t('10:05', 'Customer submitted request'),
      t('10:31', 'A. Bello (Operations) rejected · payout account not verified'),
      t('10:31', 'Customer notified'),
    ],
  },
  {
    id: 't5',
    ref: 'YLD-PROTO-0098',
    customer: 'CUS-0042',
    kind: 'yield',
    type: 'Yield reward',
    amount: '+1.89 XRP',
    time: 'Oct 3 00:10',
    status: 'Credited',
    tone: 'ok',
    queueId: null,
    rows: [r('Product', 'XRP Flexible'), r('Gross / fee', '2.10 / 0.21 XRP'), r('Provider statement', 'Matched')],
    journal: [j('Yield provider receivable · XRP', '2.10', ''), j('Customer available · XRP', '', '1.89'), j('Fee revenue · XRP', '', '0.21')],
    timeline: [t('00:02', 'Provider statement received'), t('00:10', 'Matched and credited')],
  },
  {
    id: 't6',
    ref: 'LN-PROTO-0007',
    customer: 'CUS-0042',
    kind: 'loan',
    type: 'Loan funding',
    amount: '$600.00',
    time: 'Sep 19 14:20',
    status: 'Funded',
    tone: 'ok',
    queueId: null,
    rows: [r('Collateral', '750.00 XRP locked'), r('APR', '10% fixed'), r('Margin call / liquidation', '65% / 80% LTV'), r('Provider', '[Lending provider]')],
    journal: [j('Customer available · XRP', '750.00', ''), j('Customer collateral · XRP', '', '750.00')],
    timeline: [t('Sep 18', 'Application submitted'), t('Sep 18', 'K. Musa (Compliance) approved'), t('Sep 19', 'Provider confirmed funding')],
  },
  {
    id: 't7',
    ref: 'DEP-PROTO-2050',
    customer: 'Unattributed',
    kind: 'deposit',
    type: 'Deposit (no tag)',
    amount: '+500.00 XRP',
    time: 'Today 11:47',
    status: 'Exception',
    tone: 'bad',
    queueId: 'dep2050',
    rows: [r('From', 'rSendr…k3P', true), r('Destination tag', 'Missing'), r('Claimed by', 'CUS-0311 · SUP-0921')],
    journal: [j('Custody omnibus · XRP', '500.00', ''), j('Unattributed deposits · XRP', '', '500.00')],
    timeline: [t('11:47', 'Validated on ledger without tag'), t('11:47', 'Posted to suspense'), t('12:10', 'Support linked ticket SUP-0921')],
  },
  {
    id: 't8',
    ref: 'YLD-PROTO-0112',
    customer: 'CUS-0233',
    kind: 'yield',
    type: 'Yield allocation',
    amount: '300.00 XRP',
    time: 'Today 12:11',
    status: 'At provider',
    tone: 'wait',
    queueId: 'yd0112',
    rows: [r('Product', 'XRP Flexible'), r('Provider', '[Yield provider]'), r('Confirmation', 'Delayed · 41m')],
    journal: [j('Customer available · XRP', '300.00', ''), j('Customer pending yield · XRP', '', '300.00')],
    timeline: [t('12:11', 'Customer submitted allocation'), t('12:12', 'Sent to provider')],
  },
];

const TXS: TxItem[] = [
  ...TX_SEED.map((x) => ({ asset: 'XRP', manualSend: false, settle: null, ...x })),
  {
    id: 't9',
    ref: 'WD-PROTO-2044',
    customer: 'CUS-0098',
    kind: 'withdrawal',
    type: 'Withdrawal · BTC',
    amount: '−0.012500 BTC',
    time: 'Today 10:05',
    status: 'Approved',
    tone: 'wait',
    queueId: null,
    asset: 'BTC',
    manualSend: true,
    settle: null,
    rows: [r('To', 'bc1qar0srrr7xfkvy5l643lyd…mdq', true), r('Network', 'Bitcoin'), r('Fee', '0.00005 BTC'), r('Approvals', '1 of 1 · K. Musa')],
    journal: [j('Customer available · BTC', '0.0125', ''), j('Customer reserved · BTC', '', '0.0125')],
    timeline: [t('10:05', 'Customer submitted (confirmed on device)'), t('10:05', 'System reserved 0.012500 BTC'), t('10:40', 'K. Musa (Compliance) approved')],
  },
  {
    id: 't10',
    ref: 'DEP-PROTO-2052',
    customer: 'CUS-0042',
    kind: 'deposit',
    type: 'Deposit · USDT (reported)',
    amount: '+500.00 USDT',
    time: 'Today 10:58',
    status: 'Confirming',
    tone: 'wait',
    queueId: 'dep2052',
    asset: 'USDT',
    manualSend: false,
    settle: null,
    rows: [r('Network', 'Tron (TRC-20)'), r('Transaction hash', 'a3f1c9e07b…b9c0d1e2', true), r('Reported by', 'Customer')],
    journal: [],
    timeline: [t('10:58', 'Customer reported deposit')],
  },
  {
    id: 't11',
    ref: 'EX-PROTO-0331',
    customer: 'CUS-0042',
    kind: 'exchange',
    type: 'Sell · XRP for USD',
    amount: '−500.00 XRP',
    time: 'Today 11:20',
    status: 'Accepted',
    tone: 'wait',
    queueId: null,
    asset: 'XRP',
    manualSend: false,
    settle: 'usd',
    rows: [r('Pay to', 'Access Bank'), r('Account number', '0123456789', true), r('Account name', 'Tobi Adeyemi'), r('Quote accepted', '$652.40')],
    journal: [j('Customer available · XRP', '500.00', ''), j('Customer reserved · XRP', '', '500.00')],
    timeline: [t('11:12', 'Customer submitted'), t('11:15', 'A. Bello (Operations) approved · firm quote sent'), t('11:20', 'Customer accepted the quote')],
  },
];

/** Extra demo holdings beyond each customer's XRP (amounts in whole coins). */
const EXTRA: Record<string, [string, string, string, string][]> = {
  'CUS-0042': [
    ['BTC', '0.0425', '0.01', '0'],
    ['ETH', '0.82', '0', '0'],
    ['USDT', '1250', '500', '0'],
    ['SOL', '12.5', '0', '0'],
  ],
  'CUS-0098': [
    ['BTC', '0.31', '0', '0.05'],
    ['ETH', '2.4', '1', '0'],
  ],
  'CUS-0187': [['USDC', '4200', '0', '0']],
  'CUS-0311': [['DOGE', '15000', '0', '0']],
};

type User = Omit<CustomerRecord, 'masked' | 'frozen' | 'flags' | 'devices' | 'activity' | 'holdings' | 'totalUsdCents'> & {
  availableDrops: bigint;
  yieldDrops: bigint;
  collateralDrops: bigint;
  flags: string[];
  devices?: CustomerRecord['devices'];
  activity?: CustomerRecord['activity'];
};
const USERS: User[] = [
  {
    id: 'CUS-0042',
    accountRef: 'CUS-0042',
    name: 'Tobi Adeyemi',
    email: 'tobi.adeyemi@example.com',
    phone: '+234 803 555 4821',
    dob: '1991-04-12',
    country: 'Nigeria',
    kyc: 'Verified · level 2',
    kycTone: 'ok',
    joined: 'Sep 2, 2026',
    risk: 'Low',
    availableDrops: X('4170.10'),
    yieldDrops: X('1500'),
    collateralDrops: X('750'),
    flags: ['Active loan LN-PROTO-0007', 'Withdrawal WD-PROTO-2042 awaiting approval'],
    latestTxId: 't2',
    devices: [
      { name: 'iPhone 15 · XRP Ledger app', location: 'Lagos, Nigeria', lastActive: 'Active now', revoked: false },
      { name: 'Chrome on macOS', location: 'Lagos, Nigeria', lastActive: 'Oct 19 09:14', revoked: false },
    ],
    activity: [
      { title: 'New sign-in · Chrome on macOS', meta: 'Lagos, Nigeria', at: 'Oct 19 09:14' },
      { title: 'Allowlist address added', meta: 'Exchange account', at: 'Oct 18 12:00' },
      { title: 'Two-factor turned on', meta: 'iPhone 15', at: 'Sep 2 10:25' },
      { title: 'Account created', meta: 'Lagos, Nigeria', at: 'Sep 2 10:14' },
    ],
  },
  {
    id: 'CUS-0187',
    accountRef: 'CUS-0187',
    name: 'Hauwa Bello',
    email: 'hauwa.b@example.com',
    phone: '+234 806 555 1290',
    dob: '1988-11-30',
    country: 'Nigeria',
    kyc: 'Verified · level 2',
    kycTone: 'ok',
    joined: 'Aug 14, 2026',
    risk: 'Low',
    availableDrops: X('920'),
    yieldDrops: 0n,
    collateralDrops: 0n,
    flags: [],
    latestTxId: 't1',
  },
  {
    id: 'CUS-0311',
    accountRef: 'CUS-0311',
    name: 'Ngozi Eze',
    email: 'ngozi.eze@example.com',
    phone: '+234 809 555 7714',
    dob: '1995-02-08',
    country: 'Nigeria',
    kyc: 'Verified · level 1',
    kycTone: 'ok',
    joined: 'Oct 1, 2026',
    risk: 'Low',
    availableDrops: X('2310'),
    yieldDrops: 0n,
    collateralDrops: 0n,
    flags: ['Claims DEP-PROTO-2050 (500 XRP, no tag) · SUP-0921'],
    latestTxId: 't1',
  },
  {
    id: 'CUS-0098',
    accountRef: 'CUS-0098',
    name: 'Emeka Obi',
    email: 'emeka.obi@example.com',
    phone: '+44 7700 900312',
    dob: '1984-07-21',
    country: 'United Kingdom',
    kyc: 'Verified · level 2',
    kycTone: 'ok',
    joined: 'Jul 30, 2026',
    risk: 'Medium',
    availableDrops: X('2000'),
    yieldDrops: 0n,
    collateralDrops: 0n,
    flags: ['Loan application LN-PROTO-0009'],
    latestTxId: 't1',
  },
  {
    id: 'CUS-0233',
    accountRef: 'CUS-0233',
    name: 'Funke Ade',
    email: 'funke.ade@example.com',
    phone: '+234 802 555 0045',
    dob: '1999-09-17',
    country: 'Nigeria',
    kyc: 'Pending review',
    kycTone: 'wait',
    joined: 'Oct 15, 2026',
    risk: 'Not rated',
    availableDrops: X('120'),
    yieldDrops: X('300'),
    collateralDrops: 0n,
    flags: ['Proof of address under review'],
    latestTxId: 't8',
  },
];

type AuditSeed = [at: string, actor: string, type: AuditRow['actorType'], action: string, target: string, role?: Role];
const AUDIT: AuditSeed[] = [
  ['12:50', 'System', 'system', 'Audit chain verified', '—'],
  ['12:44', 'CUS-0187', 'customer', 'Submitted withdrawal (confirmed on device)', 'WD-PROTO-2043'],
  ['12:41', 'J. Duru', 'staff', 'Approved withdrawal · 1 of 2', 'WD-PROTO-2042'],
  ['12:38', 'CUS-0042', 'customer', 'Submitted exchange request', 'EX-PROTO-0318'],
  ['12:30', 'System', 'system', 'Reserved 1,250.00 XRP', 'WD-PROTO-2042'],
  ['12:11', 'CUS-0233', 'customer', 'Allocated 300 XRP to XRP Flexible', 'YLD-PROTO-0112'],
  ['12:10', 'M. Okon', 'staff', 'Linked ticket to deposit', 'SUP-0921'],
  ['12:00', 'System', 'system', 'Reconciliation run completed · 3 exceptions', 'RC-PROTO-0412'],
  ['11:47', 'System', 'system', 'Posted deposit to suspense (no tag)', 'DEP-PROTO-2050'],
  ['10:05', 'A. Bello', 'staff', 'Requested signing policy change', 'POL-v4'],
  ['09:52', 'CUS-0098', 'customer', 'Submitted loan application', 'LN-PROTO-0009'],
  ['09:14', 'CUS-0042', 'customer', 'Signed in · Chrome on macOS', 'Session'],
  ['08:30', 'K. Musa', 'staff', 'Signed in to Ops console', 'Session'],
];

/** The design's display hash (FNV-1a over the entry and the one before it). Real mode shows the SHA-256 chain. */
const fnv = (str: string): string => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `${`0000000${h.toString(16)}`.slice(-8)}…`;
};

type State = {
  queue: QueueItem[];
  frozen: Set<string>;
  flagged: Set<string>;
  feeBooked: boolean;
  yieldContacted: string | null;
  runs: number;
  lastRunAt: string | null;
  policy: 'pending' | 'approved' | 'declined';
  /** Entries this demo session added: [at, actor, type, action, target, role]. */
  mine: AuditSeed[];
  /** Queue items acted on in this session; their transactions show the live status. */
  touched: Set<string>;
  /** Deposit addresses and on/off per asset, as Compliance set them. */
  assetCfg: Record<string, { address: string | null; memo: string | null; enabled: boolean; networks?: Record<string, string | null> }>;
  /** Outcome of manually sent withdrawals. */
  sent: Record<string, { hash: string } | { failed: string }>;
  /** Identity decisions made this session, by customer. */
  identity: Record<string, IdentityCheck['status']>;
};

/** Sample deposit addresses so the demo shows the flow; never send funds to them. */
const DEMO_ADDRESSES: Record<string, string> = {
  BTC: 'bc1qdemo0address0do0not0send0funds0xyz9k',
  ETH: '0xDe00000000000000000000000000000000000001',
  USDT: 'TDemoAddressDoNotSendFundsXyz12345',
  USDC: '0xDe00000000000000000000000000000000000001',
  SOL: 'DemoSo1anaAddressDoNotSendFunds11111111111',
  BNB: '0xDe00000000000000000000000000000000000001',
};

const fresh = (): State => ({
  queue: initialQueue(),
  frozen: new Set(),
  flagged: new Set(),
  feeBooked: false,
  yieldContacted: null,
  runs: 0,
  lastRunAt: null,
  policy: 'pending',
  mine: [],
  touched: new Set(),
  assetCfg: Object.fromEntries(ASSETS.map((a) => [a.id, { address: DEMO_ADDRESSES[a.id] ?? null, memo: null, enabled: true }])),
  sent: {},
  identity: {},
});
const g = globalThis as { __xrpAdminDemo?: State };
const state = (): State => (g.__xrpAdminDemo ??= fresh());
/** Tests and the "reset demo" control start over. */
export const resetDemo = () => {
  g.__xrpAdminDemo = fresh();
};

const REASONS: Record<string, string> = {
  screening: 'Destination failed screening',
  evidence: 'Insufficient evidence',
  limits: 'Exceeds limits',
  customer: 'Customer cancelled',
};

export const createDemoData = (role: Role): AdminData => {
  const me = STAFF[role];
  const log = (action: string, target: string) => state().mine.unshift([hm(now()), 'You', 'staff', action, target, role]);
  const excOpen = () => {
    const s = state();
    const depDone = s.queue.find((q) => q.id === 'dep2050')?.decided?.kind === 'approved';
    return [!s.feeBooked, !depDone, true].filter(Boolean).length;
  };

  return {
    mode: 'demo',
    me: async () => me,

    overview: async () => {
      const s = state();
      const pending = s.queue.filter((q) => queueStatus(q)[1] === 'wait').length;
      const depDone = s.queue.find((q) => q.id === 'dep2050')?.decided?.kind === 'approved';
      return {
        pending,
        oldest: 'Oldest 3h · LN-PROTO-0009',
        liabilitiesDrops: X('1284610.25'),
        coveragePct: '100.00%',
        exceptionsOpen: excOpen(),
        lastRun: s.lastRunAt ?? '12:00',
        outflowTodayDrops: X('41280'),
        outflowLimitDrops: X('150000'),
        providers: [
          { name: '[Custody provider]', note: 'API 120 ms · last balance sync 12:50', status: 'Operational', tone: 'ok' },
          { name: 'XRP Ledger nodes', note: 'Validated ledger 92,418,307 · 2 of 2 nodes in sync', status: 'Operational', tone: 'ok' },
          { name: '[KYC provider]', note: '3 checks in progress · median 4 min', status: 'Operational', tone: 'ok' },
          { name: '[Screening provider]', note: 'Last response 12:44', status: 'Operational', tone: 'ok' },
          { name: '[Yield provider]', note: 'Allocation confirmations delayed ~40 min', status: 'Degraded', tone: 'wait' },
          { name: '[Lending provider]', note: '1 credit decision pending', status: 'Operational', tone: 'ok' },
          { name: '[Market data provider]', note: 'XRP $2.38 · updated 12:50', status: 'Operational', tone: 'ok' },
        ],
        attention: [
          {
            title: 'WD-PROTO-2042 needs a second approval',
            note: '1,250.00 XRP · over 1,000 XRP threshold',
            where: 'Queue',
            href: '/queue?sel=wd2042',
            tone: 'wait',
          },
          {
            title: 'Deposit without destination tag',
            note: 'DEP-PROTO-2050 · 500.00 XRP in suspense',
            where: 'Reconciliation',
            href: '/reconciliation',
            tone: depDone ? 'ok' : 'bad',
          },
          { title: 'Proof of address review', note: 'CUS-0233 · submitted Oct 15', where: 'Users', href: '/users?sel=CUS-0233', tone: 'wait' },
          {
            title: 'Signing policy change waiting',
            note: 'Hot wallet ceiling → 120,000 XRP',
            where: 'Custody',
            href: '/custody',
            tone: s.policy === 'pending' ? 'wait' : 'ok',
          },
        ],
      };
    },

    queue: async () => structuredClone(state().queue),

    transactions: async () =>
      TXS.map((tx) => {
        const done = state().sent[tx.id];
        if (done) {
          return 'hash' in done
            ? {
                ...tx,
                status: 'Completed',
                tone: 'ok' as const,
                manualSend: false,
                settle: null,
                rows: [...tx.rows, r(tx.kind === 'exchange' ? 'Bank reference' : 'Transaction hash', done.hash, true)],
              }
            : { ...tx, status: 'Failed', tone: 'bad' as const, manualSend: false, settle: null, rows: [...tx.rows, r('Reason', done.failed)] };
        }
        const q = tx.queueId && state().touched.has(tx.queueId) ? state().queue.find((x) => x.id === tx.queueId) : undefined;
        if (!q) return tx;
        const [status, tone] = queueStatus(q);
        return { ...tx, status, tone };
      }),

    customers: async () => {
      const s = state();
      const depDone = s.queue.find((q) => q.id === 'dep2050')?.decided?.kind === 'approved';
      const usdtDone = s.queue.find((q) => q.id === 'dep2052')?.decided?.kind === 'approved';
      const prices = await livePrices();
      const value = (h: Omit<HoldingRow, 'valueCents'>): HoldingRow => ({
        ...h,
        valueCents: unitsToCents(h.available + h.yield + h.collateral + h.reserved, prices.get(h.asset)?.priceMicro ?? 0n, h.asset),
      });
      return USERS.map(({ availableDrops, yieldDrops, collateralDrops, ...u }) => {
        const m = maskPersonal(u, role);
        const flags = [...u.flags];
        if (s.flagged.has(u.id)) flags.push(`Flagged for review by you · ${hm(now())}`);
        const holdings = [
          value({ asset: 'XRP', available: u.id === 'CUS-0311' && depDone ? availableDrops + X('500') : availableDrops, yield: yieldDrops, collateral: collateralDrops, reserved: 0n }),
          ...(EXTRA[u.id] ?? []).map(([asset, av, y, c]) =>
            value({
              asset,
              available: toUnits(av, asset) + (u.id === 'CUS-0042' && asset === 'USDT' && usdtDone ? toUnits('500', 'USDT') : 0n),
              yield: toUnits(y, asset),
              collateral: toUnits(c, asset),
              reserved: 0n,
            }),
          ),
        ]
          .filter((h) => h.available + h.yield + h.collateral + h.reserved > 0n)
          .sort((a, b) => (b.valueCents > a.valueCents ? 1 : b.valueCents < a.valueCents ? -1 : 0));
        const decided = s.identity[u.id];
        return {
          ...u,
          ...m,
          ...(decided
            ? {
                kyc: decided === 'verified' ? 'Verified · level 2' : decided === 'rejected' ? 'Rejected' : 'More info requested',
                kycTone: decided === 'verified' ? ('ok' as const) : decided === 'rejected' ? ('bad' as const) : ('wait' as const),
              }
            : {}),
          holdings,
          totalUsdCents: holdings.reduce((sum, h) => sum + h.valueCents, 0n),
          flags,
          devices: u.devices ?? [],
          activity: u.activity ?? [],
          frozen: s.frozen.has(u.id),
          masked: role !== 'compliance',
        };
      });
    },

    recon: async (): Promise<Recon> => {
      const s = state();
      const depDone = s.queue.find((q) => q.id === 'dep2050')?.decided?.kind === 'approved';
      const hotProvider = X('84210.250000');
      const hot = {
        name: 'Hot wallet',
        tier: 'hot' as const,
        internal: s.feeBooked ? hotProvider : X('84210.250036'),
        provider: hotProvider,
        chain: hotProvider,
      };
      const warm = { name: 'Warm wallet', tier: 'warm' as const, internal: X('250000'), provider: X('250000'), chain: X('250000') };
      const cold = { name: 'Cold vault', tier: 'cold' as const, internal: X('950400'), provider: X('950400'), chain: X('950400') };
      const total = {
        name: 'Total holdings',
        tier: 'total' as const,
        internal: hot.internal + warm.internal + cold.internal,
        provider: hot.provider + warm.provider + cold.provider,
        chain: hot.chain + warm.chain + cold.chain,
      };
      return {
        runRef: `RC-PROTO-${412 + s.runs}`,
        when: s.runs ? `Today ${s.lastRunAt} WAT` : 'Today 12:00 WAT',
        validatedLedger: s.runs ? 92418319 : 92417402,
        wallets: [hot, warm, cold, total],
        customerLiabilitiesDrops: X('1284110.25') + (depDone ? X('500') : 0n),
        suspenseDrops: depDone ? 0n : X('500'),
        exceptions: [
          {
            id: 'fee',
            kind: 'unbooked_fee',
            title: 'Network fees not booked',
            note: 'Hot wallet · 3 withdrawals · 0.000036 XRP',
            status: s.feeBooked ? 'resolved' : 'open',
            statusNote: s.feeBooked ? 'Resolved · adjustment posted' : null,
            queueId: null,
          },
          {
            id: 'dep',
            kind: 'deposit_no_tag',
            title: 'Deposit without destination tag',
            note: 'DEP-PROTO-2050 · 500.00 XRP held in suspense',
            status: depDone ? 'resolved' : 'open',
            statusNote: depDone ? 'Resolved · attributed to CUS-0311' : 'Open · claim pending',
            queueId: 'dep2050',
          },
          {
            id: 'yld',
            kind: 'provider_delay',
            title: 'Provider confirmation delayed',
            note: 'YLD-PROTO-0112 · 300.00 XRP pending at [Yield provider] for 41m',
            status: 'investigating',
            statusNote: s.yieldContacted ? `Investigating · provider contacted ${s.yieldContacted}` : 'Investigating',
            queueId: null,
          },
        ],
      };
    },

    custody: async (): Promise<Custody> => {
      const s = state();
      return {
        wallets: [
          {
            name: 'Hot',
            address: 'rHotProtoKcV9tYwZ2hNa19xQb',
            balanceDrops: X('84210.25'),
            signing: 'Auto-sign within policy',
            ceilingDrops: X('100000'),
            tier: 'hot',
          },
          { name: 'Warm', address: 'rWarmProtoKcV9tYwZ2hNb24mKc', balanceDrops: X('250000'), signing: '2 of 3 signers', ceilingDrops: null, tier: 'warm' },
          {
            name: 'Cold vault',
            address: 'rColdProtoKcV9tYwZ2hNc3V9tY',
            balanceDrops: X('950400'),
            signing: '3 of 5 · 24h time lock',
            ceilingDrops: null,
            tier: 'cold',
          },
        ],
        policyVersion: 'v3',
        policy: [
          ['Up to 1,000 XRP', '1 staff approval, then hot wallet auto-sign'],
          ['Over 1,000 XRP', '2 approvals, different people, one Compliance'],
          ['Warm → hot top-up', '2 of 3 signers'],
          ['Cold vault release', '3 of 5 signers · 24-hour time lock'],
          ['Destination screening', 'Required · [Screening provider]'],
          ['New customer address', '24-hour activation hold'],
        ],
        signers: [
          { name: 'J. Duru · Compliance', meta: 'Hardware key · last used 12:41', status: 'Active' },
          { name: 'K. Musa · Compliance', meta: 'Hardware key · last used Oct 18', status: 'Active' },
          { name: 'A. Bello · Operations', meta: 'Hardware key · last used 10:05', status: 'Active' },
          { name: 'M. Okon · Operations', meta: 'Hardware key · last used Oct 12', status: 'Active' },
          { name: 'Director · Treasury', meta: 'Cold vault only', status: 'Standby' },
        ],
        limits: { customerDailyDrops: X('25000'), autoSignDrops: X('1000'), platformDailyDrops: X('150000'), outflowTodayDrops: X('41280') },
        pendingChange: {
          id: 'pol-v4',
          title: 'Raise hot wallet ceiling to 120,000 XRP',
          requestedBy: 'A. Bello',
          requestedRole: 'operations',
          when: 'today 10:05',
          reason: 'Higher weekend withdrawal volume',
          status: s.policy,
          decidedByMe: s.policy !== 'pending',
        },
      };
    },

    audit: async () => {
      const all: AuditSeed[] = [...state().mine, ...AUDIT];
      return {
        verifiedAt: '12:50',
        chainOk: true,
        rows: all.map((a, i) => {
          const next = all[i + 1];
          const key = [a[0], a[1], a[2], a[3], a[4]].join('|') + (next ? [next[0], next[1], next[2], next[3], next[4]].join('|') : '');
          return {
            id: String(i),
            at: a[0],
            actor: a[1] === 'You' ? `You · ${ROLES[a[5] ?? role].name}` : a[1],
            actorType: a[2],
            action: a[3],
            target: a[4],
            hash: fnv(key),
          };
        }),
      };
    },

    recordViewed: async () => undefined,
    identity: async (customerId) => {
      const u = USERS.find((x) => x.id === customerId);
      if (!u) return null;
      const decided = state().identity[customerId];
      const pending = u.kyc.startsWith('Pending');
      return {
        status: decided ?? (pending ? 'in_progress' : 'verified'),
        documentType: 'passport',
        country: u.country,
        submittedAt: '2026-10-15T09:40:00Z',
        decidedAt: decided || !pending ? '2026-10-15T11:02:00Z' : null,
        // Demo: document names only; the live console shows the uploaded images.
        documents: ['id-photo', 'selfie', 'address-utility-bill'].map((name) => ({ name, url: null })),
      };
    },
    decideIdentity: async (customerId, decision, note) => {
      if (role !== 'compliance') return { ok: false, error: 'Only Compliance can decide identity checks.' };
      if (decision !== 'verified' && note.trim().length < 10) return { ok: false, error: 'Write a short reason — the customer sees it and it goes into the audit log.' };
      state().identity[customerId] = decision;
      log(decision === 'verified' ? 'Verified identity' : decision === 'rejected' ? 'Rejected identity check' : 'Asked for more identity information', customerId);
      return { ok: true, message: decision === 'verified' ? 'Identity verified. The customer can now use their account.' : 'Decision saved. The customer has been told why.' };
    },

    decide: async (queueId, decision, reason, note) => {
      const it = state().queue.find((q) => q.id === queueId);
      if (!it) return { ok: false, error: 'Approval not found' };
      if (it.decided || it.approvals.length >= it.required) return { ok: false, error: 'This request has already been decided.' };
      if (!ROLES[role].can.includes(it.kind)) {
        return {
          ok: false,
          error: ROLES[role].can.length ? `Your role can’t approve ${it.type.toLowerCase()}s.` : 'Read-only role: you can view but not act.',
        };
      }
      const at = hm(now());
      state().touched.add(it.id);
      if (decision === 'reject') {
        if (!reason || !REASONS[reason] || (note ?? '').trim().length < 10)
          return { ok: false, error: 'Choose a reason and write at least a short note — it goes into the audit log.' };
        const label = REASONS[reason];
        it.decided = { kind: 'rejected', reason: label, note: (note ?? '').trim() } satisfies Decision;
        it.audit.push(t(at, `You (${ROLES[role].name}) rejected · ${label} — “${(note ?? '').trim()}”`));
        if (it.journal.length) {
          it.journal = [...it.journal, ...it.journal.map((l) => j(`${l.account} (reversal)`, l.cr, l.dr))];
          it.audit.push(t(at, 'System posted compensating entry, released hold'));
        }
        log(`Rejected · ${label}`, it.ref);
        return { ok: true };
      }
      const block = approveBlock(it, me);
      if (block) return { ok: false, error: block };
      it.approvals.push({ who: me.name, at, role, staffId: me.id });
      it.audit.push(t(at, `You (${ROLES[role].name}) approved`));
      if (it.approvals.length >= it.required) it.decided = { kind: 'approved' };
      log(`Approved ${it.type.toLowerCase()}`, it.ref);
      return { ok: true };
    },

    runRecon: async () => {
      const s = state();
      s.runs += 1;
      s.lastRunAt = hm(now());
      log('Ran reconciliation', `RC-PROTO-${412 + s.runs}`);
      return { ok: true, message: 'Reconciliation run complete.' };
    },
    bookFee: async () => {
      if (role !== 'operations') return { ok: false, error: 'Fee adjustments are posted by Operations.' };
      state().feeBooked = true;
      log('Posted fee adjustment journal', 'RC-PROTO-0412');
      return { ok: true, message: 'Fee adjustment posted as a balanced journal entry.' };
    },
    contactProvider: async () => {
      if (role !== 'operations') return { ok: false, error: 'Not authorised.' };
      state().yieldContacted = hm(now());
      log('Contacted yield provider about delay', 'YLD-PROTO-0112');
      return { ok: true, message: 'Noted. The exception stays open until the provider confirms.' };
    },
    flagCustomer: async (id) => {
      if (role === 'auditor') return { ok: false, error: 'Read-only role: you can view but not act.' };
      state().flagged.add(id);
      log('Flagged customer for review', id);
      return { ok: true, message: `${id} flagged for Compliance review.` };
    },
    setFrozen: async (id, frozen) => {
      if (role !== 'compliance') return { ok: false, error: 'Only Compliance can freeze accounts.' };
      if (frozen) state().frozen.add(id);
      else state().frozen.delete(id);
      log(frozen ? 'Froze account · withdrawals blocked' : 'Unfroze account', id);
      return { ok: true, message: frozen ? `${id} frozen. Withdrawals and new requests are blocked.` : `${id} unfrozen.` };
    },
    resetPassword: async (id) => {
      if (role !== 'compliance') return { ok: false, error: 'Only Compliance can reset a customer’s password.' };
      log('Reset customer password · sessions signed out', id);
      return { ok: true, email: 'customer@example.com', password: 'Demo-pass-2345-Xy7k' };
    },
    decidePolicy: async (_id, decision) => {
      if (role !== 'compliance') return { ok: false, error: 'Separation of duties: requested by Operations, so it needs Compliance approval.' };
      state().policy = decision === 'approve' ? 'approved' : 'declined';
      log(decision === 'approve' ? 'Approved signing policy change' : 'Declined signing policy change', 'POL-v4');
      return {
        ok: true,
        message: decision === 'approve' ? 'Approved. The new ceiling applies after a 24-hour delay.' : 'Change declined. A. Bello has been notified.',
      };
    },
    exportAudit: async (filter) => {
      const { rows } = await createDemoData(role).audit();
      const list = rows.filter((x) => filter === 'all' || x.actorType === filter);
      log('Exported audit log (CSV)', 'Audit log');
      const csv = [
        'at,actor,type,action,target,hash',
        ...list.map((x) => [x.at, x.actor, x.actorType, x.action, x.target, x.hash].map((v) => `"${v.replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      return { ok: true, message: 'Export ready. The export itself is recorded in the log.', csv, filename: `audit-log-${filter}.csv` };
    },

    assets: async (): Promise<AssetRow[]> => {
      const s = state();
      const prices = await livePrices();
      const users = await createDemoData(role).customers();
      return ASSETS.map((a) => {
        const cfg = s.assetCfg[a.id] ?? { address: null, memo: null, enabled: true };
        const p = prices.get(a.id);
        return {
          id: a.id,
          name: a.name,
          network: a.network,
          depositMode: a.deposit,
          depositAddress: a.deposit === 'automatic' ? 'rP9prototype0not0a0real0address' : cfg.address,
          depositMemo: cfg.memo,
          memoKind: a.memo,
          networks: a.networks.map((n, i) => ({
            id: n.id,
            name: n.name,
            address: a.deposit === 'automatic' ? 'rP9prototype0not0a0real0address' : i === 0 ? cfg.address : (cfg.networks?.[n.id] ?? null),
          })),
          enabled: cfg.enabled,
          priceMicro: p?.priceMicro ?? 0n,
          changeBps: p?.changeBps ?? 0,
          priceAt: p?.at ?? '',
          liabilities: users.reduce((sum, u) => {
            const h = u.holdings.find((x) => x.asset === a.id);
            return sum + (h ? h.available + h.yield + h.collateral + h.reserved : 0n);
          }, 0n),
          pendingDeposits: s.queue.filter((q) => q.kind === 'deposit' && !q.decided && q.type.endsWith(`· ${a.id}`)).length,
          awaitingSend: TXS.filter((x) => x.asset === a.id && x.manualSend && !s.sent[x.id]).length,
        };
      });
    },
    updateAsset: async (asset, depositAddress, memo, enabled, networks = {}) => {
      if (role !== 'compliance') return { ok: false, error: 'Only Compliance can change deposit addresses.' };
      const a = ASSETS.find((x) => x.id === asset);
      if (!a) return { ok: false, error: 'Unsupported asset.' };
      if (a.deposit === 'automatic') return { ok: false, error: `${a.name} deposits use the custody wallet address.` };
      const addr = depositAddress?.trim() || null;
      if (addr && !isAssetAddress(asset, addr, a.networks[0]!.id)) return { ok: false, error: `That isn’t a valid ${a.network} address.` };
      for (const [id, value] of Object.entries(networks)) {
        const n = a.networks.find((x) => x.id === id);
        if (!n) return { ok: false, error: `${asset} isn’t available on that network.` };
        if (value?.trim() && !isAssetAddress(asset, value.trim(), id)) return { ok: false, error: `That isn’t a valid ${n.name} address.` };
      }
      const prev = state().assetCfg[asset]?.networks ?? {};
      const extra = Object.fromEntries(Object.entries(networks).map(([id, value]) => [id, value?.trim() || null]));
      state().assetCfg[asset] = { address: addr, memo: memo?.trim() || null, enabled, networks: { ...prev, ...extra } };
      log(`Set ${asset} deposit address${addr ? ` · ${addr.slice(0, 10)}…` : ' (closed)'}`, asset);
      return { ok: true, message: `${asset} settings saved.` };
    },
    recordDeposit: async (customerId, asset, amountUnits, txHash, note) => {
      if (role === 'auditor') return { ok: false, error: 'Read-only role: you can view but not act.' };
      if (amountUnits <= 0n) return { ok: false, error: 'Enter the amount received.' };
      if (txHash.trim().length < 8) return { ok: false, error: 'Enter the transaction hash from the network.' };
      const s = state();
      const n = 3000 + s.queue.length;
      const amount = formatAmount(amountUnits, asset);
      s.queue.push({
        id: `rec${n}`,
        ref: `DEP-PROTO-${n}`,
        customer: customerId,
        kind: 'deposit',
        type: `Deposit confirmation · ${asset}`,
        amount,
        age: '0m',
        summary: `Recorded by ${me.name} · hash ${txHash.slice(0, 10)}… · confirm on ${assetSpec(asset).network} before approving`,
        checks: [check(`Recorded by ${me.name}`, `${amount}${note ? ` · ${note}` : ''}`, 'ok'), check('Second-person check', `Confirm on ${assetSpec(asset).network}`, 'wait')],
        required: 1,
        approvals: [],
        journal: [],
        audit: [t(hm(now()), `${me.name} recorded deposit of ${amount}`)],
        decided: null,
        requestedBy: me.id,
        claimant: null,
      });
      log(`Recorded deposit of ${amount} for approval`, customerId);
      return { ok: true, message: 'Deposit recorded. A second staff member approves the credit in the queue.' };
    },
    completeExchange: async (txId, reference) => {
      if (role === 'auditor') return { ok: false, error: 'Read-only role: you can view but not act.' };
      const tx = TXS.find((x) => x.id === txId);
      if (!tx || !tx.settle || state().sent[txId]) return { ok: false, error: 'Only exchanges the customer has accepted can be completed.' };
      if (tx.settle === 'usd' && reference.trim().length < 4) return { ok: false, error: 'Enter the bank transfer reference.' };
      state().sent[txId] = { hash: reference.trim() || '—' };
      log(tx.settle === 'usd' ? 'Paid USD sale by bank transfer' : 'Completed swap', tx.ref);
      return { ok: true, message: 'Completed. The customer has been told.' };
    },
    completeWithdrawal: async (txId, outcome) => {
      if (role === 'auditor') return { ok: false, error: 'Read-only role: you can view but not act.' };
      const tx = TXS.find((x) => x.id === txId);
      if (!tx || !tx.manualSend || state().sent[txId]) return { ok: false, error: 'Only approved withdrawals can be marked as sent.' };
      if (outcome.action === 'sent') {
        if (outcome.txHash.trim().length < 8) return { ok: false, error: 'Enter the transaction hash from the network.' };
        state().sent[txId] = { hash: outcome.txHash.trim() };
        log('Marked withdrawal sent', tx.ref);
        return { ok: true, message: 'Marked sent. The fee is booked and the customer notified.' };
      }
      if (outcome.reason.trim().length < 10) return { ok: false, error: 'Write a short reason — it goes into the audit log.' };
      state().sent[txId] = { failed: outcome.reason.trim() };
      log('Marked withdrawal failed · funds returned', tx.ref);
      return { ok: true, message: 'Marked failed. The funds are back in the customer’s balance.' };
    },
    changePassword: async (current, next) => {
      if (!current) return { ok: false, error: 'Your current password isn’t right.' };
      if (current === next) return { ok: false, error: 'Choose a password you haven’t used here before.' };
      log('Changed own password', 'Account');
      return { ok: true, message: 'Password updated. Other devices were signed out.' };
    },
  };
};

export const DEMO_STAFF = STAFF;

