/** XRP amounts in drops (1 XRP = 1,000,000 drops). Never a float. */
export type Drops = bigint;
/** Amount of any asset in base units at its ledger precision (see `ASSETS` in @xrp/ledger). XRP units are drops. */
export type Units = bigint;
/** USD amounts in integer cents. Never a float. */
export type Cents = bigint;
/** USD prices in micro-dollars (1e-6 USD), so $2.3742 = 2_374_200n. */
export type MicroUsd = bigint;
/** Basis points: 10000 = 100%. */
export type Bps = number;
export type IsoDateTime = string;

export type KycStatus = 'not_started' | 'in_progress' | 'more_info' | 'verified' | 'rejected' | 'restricted';
export type StaffRole = 'operations' | 'compliance' | 'auditor';
export type ThemePreference = 'dark' | 'light' | 'system';
/** ISO 4217 code of the currency values are shown in (money itself is always USD). */
export type DisplayCurrency = string;

export type LedgerAccountKind =
  'available' | 'reserved' | 'pending_yield' | 'yield' | 'collateral' | 'omnibus' | 'suspense' | 'fee_revenue' | 'provider_receivable';

export type TxKind = 'deposit' | 'withdrawal' | 'exchange' | 'yield_allocate' | 'yield_redeem' | 'yield_reward' | 'loan' | 'loan_repay' | 'loan_collateral';

/** `reported`: a non-XRP deposit the customer reported, waiting for staff to confirm it on the network. */
export type DepositStatus = 'detected' | 'validated' | 'screened' | 'credited' | 'no_tag' | 'screening_hold' | 'reported' | 'rejected';
export type WithdrawalStatus = 'requested' | 'in_review' | 'approved' | 'submitted' | 'validated' | 'rejected' | 'failed' | 'cancelled';
export type ExchangeStatus = 'requested' | 'quote_requested' | 'quoted' | 'accepted' | 'sold' | 'paid_out' | 'rejected' | 'quote_expired' | 'cancelled';
export type YieldAllocateStatus = 'requested' | 'sent' | 'confirmed' | 'provider_failed';
export type YieldRedeemStatus = 'requested' | 'sent' | 'confirmed' | 'provider_failed';
export type YieldRewardStatus = 'statement_received' | 'matched' | 'credited' | 'mismatch';
export type LoanStatus = 'applied' | 'approved' | 'collateral_locked' | 'funded' | 'active' | 'repaid' | 'margin_call' | 'liquidating' | 'rejected';
export type LoanRepayStatus = 'recorded' | 'awaiting_payment' | 'selling' | 'received' | 'applied' | 'failed';
export type LoanCollateralStatus = 'recorded' | 'sent' | 'lock_confirmed' | 'ltv_updated' | 'failed';

export type TxStatusByKind = {
  deposit: DepositStatus;
  withdrawal: WithdrawalStatus;
  exchange: ExchangeStatus;
  yield_allocate: YieldAllocateStatus;
  yield_redeem: YieldRedeemStatus;
  yield_reward: YieldRewardStatus;
  loan: LoanStatus;
  loan_repay: LoanRepayStatus;
  loan_collateral: LoanCollateralStatus;
};
export type TxStatus = TxStatusByKind[TxKind];

/** UI tone used by the shared Status component. */
export type Tone = 'ok' | 'wait' | 'bad' | 'off';

export type TxEvent = {
  fromStatus: TxStatus | null;
  toStatus: TxStatus;
  at: IsoDateTime;
  actor: string;
  note?: string;
};

export type Transaction<K extends TxKind = TxKind> = {
  id: string;
  ref: string;
  customerId: string;
  kind: K;
  status: TxStatusByKind[K];
  /** Asset of `amountDrops` and the fees (base units at its ledger precision). */
  asset: string;
  /** Swaps: the asset bought and how much of it the customer receives. */
  counterAsset?: string | null;
  counterAmount?: bigint | null;
  /** Signed from the customer's point of view: + in, − out. */
  amountDrops?: Drops;
  amountCents?: Cents;
  createdAt: IsoDateTime;
  counterparty?: string;
  destinationTag?: string | null;
  ledgerHash?: string | null;
  ledgerIndex?: number | null;
  platformFeeDrops?: Drops;
  networkFeeDrops?: Drops;
  meta: Record<string, string>;
  events: TxEvent[];
};

export type Balances = {
  available: Drops;
  reserved: Drops;
  pendingYield: Drops;
  yield: Drops;
  collateral: Drops;
};

export type Loan = {
  id: string;
  ref: string;
  principalCents: Cents;
  interestCents: Cents;
  aprBps: Bps;
  collateralDrops: Drops;
  collateralAsset: string;
  marginBps: Bps;
  liquidationBps: Bps;
  status: LoanStatus;
  fundedAt: IsoDateTime;
  nextInterestDue: IsoDateTime;
  originationFeeCents: Cents;
};

export type YieldPosition = {
  /** `<asset>_flexible`, e.g. `xrp_flexible`. */
  product: string;
  asset: string;
  allocatedDrops: Drops;
  aprBps: Bps;
  feeBps: Bps;
  since: IsoDateTime;
  creditedDrops: Drops;
  confirmedUnpaidDrops: Drops;
  estimatedAccruedDrops: Drops;
};

export type NotificationType = 'tx' | 'security' | 'account';
export type AppNotification = {
  id: string;
  type: NotificationType;
  tone: 'ok' | 'warn' | 'bad' | '';
  icon: 'recv' | 'shield' | 'coin' | 'alert' | 'doc' | 'ex' | 'clock';
  title: string;
  body: string;
  createdAt: IsoDateTime;
  link: string;
  readAt: IsoDateTime | null;
};

export type AllowlistAddress = {
  id: string;
  asset: string;
  memo?: string | null;
  label: string;
  address: string;
  tag: string | null;
  activeFrom: IsoDateTime;
};

export type Device = {
  id: string;
  name: string;
  location: string;
  lastActive: IsoDateTime;
  kind: 'phone' | 'laptop';
  current: boolean;
};

export type SecurityEvent = { id: string; title: string; meta: string; at: IsoDateTime };

export type TicketMessage = { from: 'me' | 'them'; text: string; meta: string };
export type SupportTicket = {
  ref: string;
  subject: string;
  topic: string;
  transactionRef: string | null;
  createdAt: IsoDateTime;
  status: 'open' | 'waiting_on_us' | 'waiting_on_you' | 'resolved';
  messages: TicketMessage[];
};

export type LegalDocumentId = 'tos' | 'privacy' | 'risk' | 'custody' | 'deposits' | 'fees' | 'yield' | 'lending' | 'complaints';
export type Consent = { document: LegalDocumentId; version: string; acceptedAt: IsoDateTime; surface: string; consentId: string };

export type CustomerProfile = {
  id: string;
  accountRef: string;
  fullName: string;
  displayName: string;
  initials: string;
  email: string;
  country: string;
  currency: DisplayCurrency;
  kycStatus: KycStatus;
  allowlistEnabled: boolean;
  passwordChangedAt: IsoDateTime;
  frozen: boolean;
};

export type ExternalWallet = {
  address: string;
  access: 'watch' | 'self_custody';
  /** Network id (`xrp`, `bitcoin`, `ethereum`, …). */
  network: string;
  /** XRP balance (XRP Ledger wallets); kept for the XRP-only screens. */
  balanceDrops: Drops;
  /** Every supported asset's balance on this network, in base units. */
  balances: Record<string, bigint>;
};
