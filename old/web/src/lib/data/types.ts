/** Data the customer dashboard reads and writes. Balances are integer units (drops for XRP); prices micro-USD. */

export type PeriodId = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
export const PERIOD_IDS: PeriodId[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

export type Asset = {
  id: string;
  name: string;
  ticker: string;
  network: string;
  glyph: string;
  color: string;
  /** Balance in the asset's smallest unit (drops for XRP). */
  units: bigint;
  /** Smallest units per whole coin, as a power of ten (6 for XRP). */
  scale: number;
  /** Decimals shown for balances. */
  decimals: number;
  priceMicro: bigint;
  /** 24h change in basis points. */
  changeBps: number;
  /** Change over each chart period, basis points. */
  periodChangeBps: Record<PeriodId, number>;
  /** Network fee for a withdrawal, in smallest units. */
  feeUnits: bigint;
  usesTag: boolean;
  /** Which field `usesTag` means on this network: a numeric destination tag (XRP) or a text memo (XLM, TON). */
  memoKind?: 'tag' | 'memo' | null;
  placeholder: string;
  /** Price-only listing (shown on Markets, not held, can't be opened). */
  held: boolean;
};

export type TxKind = 'receive' | 'send' | 'exchange' | 'buy';
export type TxStatus = 'completed' | 'pending' | 'review' | 'failed';
export type Tx = {
  id: string;
  kind: TxKind;
  asset: string;
  title: string;
  date: string;
  amount: string;
  secondary?: string;
  fiat: string;
  status: TxStatus;
  party: string;
  fee: string;
  ref: string;
  ledger: string | null;
};

export type Notice = { id: string; text: string; time: string; tone: 'warn' | 'accent' };

export type Snapshot = {
  displayName: string;
  initials: string;
  email: string;
  verified: boolean;
  displayCurrency: string;
  assets: Asset[];
  /** Portfolio value now, cents, and its change over each period, cents. */
  portfolioCents: bigint;
  portfolioChangeCents: Record<PeriodId, bigint>;
  /** Wording for the period suffix of ALL ("since Oct 2021"). */
  allTimeSuffix: string;
  txs: Tx[];
  notices: Notice[];
  security: { allowlist: boolean; allowlistCount: number; lastSignIn: string; passwordChanged: string };
  notifications: { receipts: boolean; alerts: boolean };
};

/** `reported`: send to the platform address, then report the transaction so staff can confirm and credit it. */
export type DepositInfo = { address: string; tag: string | null; network: string; real: boolean; mode?: 'automatic' | 'reported'; open?: boolean };

export type SeriesPoint = { v: number; axis: string; tip: string };

export type WithdrawInput = { assetId: string; units: bigint; destination: string; tag: string | null; idempotencyKey: string };

export type Result<T = undefined> = { ok: true; value: T; message?: string } | { ok: false; error: string };

export type DashboardSource = {
  mode: 'demo' | 'live';
  load(): Promise<Snapshot>;
  series(assetId: string | null, period: PeriodId): Promise<SeriesPoint[]>;
  deposit(assetId: string): Promise<DepositInfo>;
  /** Live: fees come out of the amount (300 → 299.749988 received). Demo: added on top, as in the design. */
  feesDeducted: boolean;
  withdraw(input: WithdrawInput): Promise<Result<{ ref: string; tx: Tx }>>;
  setSecurity(key: 'allowlist', on: boolean): Promise<Result>;
  setNotification(key: 'receipts' | 'alerts', on: boolean): Promise<Result>;
  markRead(): Promise<void>;
  /** Purchases need a payment provider; none is contracted, so live mode hides Buy. */
  canBuy: boolean;
  signOut(): Promise<Result>;
  contactSupport(): Promise<Result>;
  changePassword(): Promise<Result>;
};
