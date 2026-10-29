/** View models for the staff console in the app. Both data sources (demo and Supabase) produce exactly these. */

export type Role = 'operations' | 'compliance' | 'auditor';
export type Tone = 'ok' | 'wait' | 'bad' | 'off';
export type CheckTone = 'ok' | 'warn' | 'wait' | 'bad';

export type Staff = { id: string; name: string; role: Role };

export const ROLES: Record<Role, { name: string; scope: string; can: QueueKind[] }> = {
  operations: { name: 'Operations Administrator', scope: 'Approve withdrawals, deposits, exchange', can: ['withdrawal', 'deposit', 'exchange', 'yield'] },
  compliance: { name: 'Compliance Officer', scope: 'Compliance review, loans, exceptions', can: ['withdrawal', 'deposit', 'loan'] },
  auditor: { name: 'Read-Only Auditor', scope: 'View only', can: [] },
};

export type QueueKind = 'withdrawal' | 'deposit' | 'exchange' | 'loan' | 'yield';
export type JournalRow = { account: string; dr: string; cr: string };
export type TimelineRow = { at: string; text: string };

export type Decision = { kind: 'approved' } | { kind: 'rejected'; reason: string; note: string };

export type QueueItem = {
  id: string;
  ref: string;
  customer: string;
  kind: QueueKind;
  type: string;
  amount: string;
  age: string;
  summary: string;
  checks: { label: string; note: string; tone: CheckTone }[];
  required: 1 | 2;
  approvals: { who: string; at: string; role: Role; staffId: string }[];
  journal: JournalRow[];
  audit: TimelineRow[];
  /** Set once this item is fully decided (it stays listed so the outcome is visible). */
  decided: Decision | null;
  /** Person who raised it (can never decide it). */
  requestedBy: string | null;
  /** Deposit attribution target, for the approve label. */
  claimant: string | null;
};

export type TxItem = {
  id: string;
  ref: string;
  customer: string;
  kind: 'deposit' | 'withdrawal' | 'exchange' | 'yield' | 'loan';
  type: string;
  amount: string;
  time: string;
  status: string;
  tone: Tone;
  rows: { k: string; v: string; mono?: boolean }[];
  journal: JournalRow[];
  timeline: TimelineRow[];
  /** Approval queue item for this transaction, when it is waiting on staff. */
  queueId: string | null;
  asset: string;
  /** An approved non-XRP withdrawal that staff send from the platform wallet and then mark sent. */
  manualSend: boolean;
  /**
   * What staff complete by hand: an accepted USD sale (pay by bank transfer) or swap (credit the coin), an approved
   * loan (pay it out by bank transfer), or a bank repayment (confirm it arrived).
   */
  settle: 'usd' | 'swap' | 'loan' | 'repayment' | null;
};

/** One asset's balances for a customer, valued at the latest price. */
export type HoldingRow = { asset: string; available: bigint; yield: bigint; collateral: bigint; reserved: bigint; valueCents: bigint };

/** A supported asset as configured on the platform, with live price and what the platform holds for customers. */
export type AssetRow = {
  id: string;
  name: string;
  network: string;
  depositMode: 'automatic' | 'reported';
  depositAddress: string | null;
  depositMemo: string | null;
  memoKind: 'tag' | 'memo' | null;
  /** Every network the asset is accepted on, default first; the default's address is `depositAddress`. */
  networks: { id: string; name: string; address: string | null }[];
  enabled: boolean;
  priceMicro: bigint;
  changeBps: number;
  priceAt: string;
  /** Sum of all customers' balances in this asset (what the platform owes). */
  liabilities: bigint;
  pendingDeposits: number;
  awaitingSend: number;
};

export type CustomerRecord = {
  id: string;
  accountRef: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  country: string;
  kyc: string;
  kycTone: Tone;
  joined: string;
  risk: string;
  /** Balances per asset, largest USD value first. */
  holdings: HoldingRow[];
  totalUsdCents: bigint;
  flags: string[];
  frozen: boolean;
  /** Masked by role on the server before it reaches the page. */
  masked: boolean;
  latestTxId: string | null;
  /** Signed-in devices, most recent first, with the city the session was last seen from. */
  devices: { name: string; location: string; lastActive: string; revoked: boolean }[];
  /** Sign-ins and account changes, most recent first. */
  activity: { title: string; meta: string; at: string }[];
};

export type ReconWalletRow = { name: string; tier: 'hot' | 'warm' | 'cold' | 'total'; internal: bigint; provider: bigint; chain: bigint };
export type ReconException = {
  id: string;
  kind: 'unbooked_fee' | 'deposit_no_tag' | 'provider_delay' | 'mismatch';
  title: string;
  note: string;
  status: 'open' | 'investigating' | 'resolved';
  statusNote: string | null;
  queueId: string | null;
};
export type Recon = {
  runRef: string;
  when: string;
  validatedLedger: number;
  wallets: ReconWalletRow[];
  customerLiabilitiesDrops: bigint;
  suspenseDrops: bigint;
  exceptions: ReconException[];
};

export type Custody = {
  wallets: { name: string; address: string; balanceDrops: bigint; signing: string; ceilingDrops: bigint | null; tier: string }[];
  policy: [string, string][];
  policyVersion: string;
  signers: { name: string; meta: string; status: 'Active' | 'Standby' }[];
  limits: { customerDailyDrops: bigint; autoSignDrops: bigint; platformDailyDrops: bigint; outflowTodayDrops: bigint };
  pendingChange: {
    id: string;
    title: string;
    requestedBy: string;
    requestedRole: Role;
    when: string;
    reason: string;
    status: 'pending' | 'approved' | 'declined';
    decidedByMe: boolean;
  } | null;
};

export type AuditRow = { id: string; at: string; actor: string; actorType: 'staff' | 'customer' | 'system'; action: string; target: string; hash: string };

export type ProviderHealthRow = { name: string; note: string; status: 'Operational' | 'Degraded' | 'Outage'; tone: Tone };

export type Overview = {
  pending: number;
  oldest: string;
  liabilitiesDrops: bigint;
  coveragePct: string;
  exceptionsOpen: number;
  lastRun: string;
  outflowTodayDrops: bigint;
  outflowLimitDrops: bigint;
  providers: ProviderHealthRow[];
  attention: { title: string; note: string; where: 'Queue' | 'Reconciliation' | 'Users' | 'Custody'; href: string; tone: Tone }[];
};

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** The rest of a customer's profile: address, crypto trust, beneficiaries and linked wallets (masked by role in SQL). */
export type CustomerExtras = {
  address: { line?: string | null; city?: string | null; region?: string | null; postalCode?: string | null; country: string };
  trust: { ref: string; type: string; status: string; createdAt: string; termsAgreedAt: string } | null;
  beneficiaries: { name: string; relationship: string; isSelf: boolean; allocationPct: number; email: string | null; wallet: string | null }[];
  wallets: { network: string; access: string; address: string; balances: Record<string, string> }[];
};

export type IdentityDecision = 'verified' | 'more_info' | 'rejected';
/** A customer's latest identity check. Document links are signed for a few minutes and only issued to Compliance. */
export type IdentityCheck = {
  status: 'in_progress' | 'more_info' | 'verified' | 'rejected' | 'restricted' | 'not_started';
  documentType: string | null;
  country: string | null;
  submittedAt: string;
  decidedAt: string | null;
  documents: { name: string; url: string | null }[];
};

/** Everything the console reads and writes. Writes are enforced again in SQL / Edge Functions. */
export type AdminData = {
  mode: 'demo' | 'supabase';
  me(): Promise<Staff | null>;
  overview(): Promise<Overview>;
  queue(): Promise<QueueItem[]>;
  transactions(): Promise<TxItem[]>;
  customers(): Promise<CustomerRecord[]>;
  recon(): Promise<Recon>;
  custody(): Promise<Custody>;
  audit(): Promise<{ rows: AuditRow[]; verifiedAt: string; chainOk: boolean }>;

  /** Compliance opening a full record; the read itself is audited in SQL. */
  recordViewed(customerId: string): Promise<void>;
  /** Address, crypto trust, beneficiaries and linked wallets. */
  customerExtras(customerId: string): Promise<CustomerExtras>;
  /** The latest identity check, or null if the customer hasn't submitted documents. */
  identity(customerId: string): Promise<IdentityCheck | null>;
  /** Compliance decides an identity check; a reason (shown to the customer) is required unless verifying. */
  decideIdentity(customerId: string, decision: IdentityDecision, note: string): Promise<ActionResult>;
  decide(queueId: string, decision: 'approve' | 'reject', reason?: string, note?: string): Promise<ActionResult>;
  runRecon(): Promise<ActionResult>;
  bookFee(exceptionId: string): Promise<ActionResult>;
  contactProvider(exceptionId: string): Promise<ActionResult>;
  flagCustomer(customerId: string): Promise<ActionResult>;
  setFrozen(customerId: string, frozen: boolean): Promise<ActionResult>;
  /** Compliance sets a new password for a customer who emailed support; it's returned once, to email back. */
  resetPassword(customerId: string): Promise<{ ok: true; email: string; password: string } | { ok: false; error: string }>;
  decidePolicy(changeId: string, decision: 'approve' | 'decline'): Promise<ActionResult>;
  exportAudit(filter: 'all' | 'staff' | 'customer' | 'system'): Promise<ActionResult & { csv?: string; filename?: string }>;

  assets(): Promise<AssetRow[]>;
  /** Compliance only: where customers send an asset (validated against its network), or close deposits. */
  /** `networks`: addresses for the asset's other networks, keyed by network id (null closes one). */
  updateAsset(
    asset: string,
    depositAddress: string | null,
    memo: string | null,
    enabled: boolean,
    networks?: Record<string, string | null>,
  ): Promise<ActionResult>;
  /** Record a deposit seen arriving for a customer; a different staff member approves the credit in the queue. */
  recordDeposit(customerId: string, asset: string, amountUnits: bigint, txHash: string, note: string): Promise<ActionResult>;
  /** Approved non-XRP withdrawal: mark sent (with the network hash) or failed (funds return to the customer). */
  /** Complete what `TxItem.settle` names; everything but a swap needs the bank transfer reference. */
  settle(txId: string, kind: NonNullable<TxItem['settle']>, reference: string): Promise<ActionResult>;
  completeWithdrawal(txId: string, outcome: { action: 'sent'; txHash: string } | { action: 'failed'; reason: string }): Promise<ActionResult>;
  /** The signed-in staff member changes their own password (current one checked on the server). */
  changePassword(current: string, next: string): Promise<ActionResult>;
};
