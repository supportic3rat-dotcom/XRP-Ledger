import type { BankPayout } from '@xrp/schemas';
import type { AssetLimits, DepositMode, MemoKind } from '@xrp/ledger';
import type {
  AllowlistAddress,
  AppNotification,
  Balances,
  Consent,
  CustomerProfile,
  Device,
  ExternalWallet,
  KycStatus,
  LegalDocumentId,
  Loan,
  MicroUsd,
  SecurityEvent,
  SupportTicket,
  Transaction,
  YieldPosition,
  Trust,
  TrustInput,
} from '@xrp/types';

export type NotificationPrefs = { receipts: boolean; alerts: boolean };

export type PriceInfo = { priceMicro: MicroUsd; changeBps: number; at: string; source: string; stale: boolean };
/** A supported asset as configured on the platform (registry + where deposits go). */
export type AssetInfo = {
  id: string;
  name: string;
  network: string;
  decimals: number;
  memo: MemoKind;
  depositMode: DepositMode;
  /** False until staff set a deposit address for a reported asset. */
  depositOpen: boolean;
  yieldAprBps: number | null;
  collateral: boolean;
  limits: AssetLimits;
};
/** One asset's balances by ledger account. */
export type Holding = Balances & { asset: string };
/**
 * Where to send an asset. `automatic` (XRP): the shared address plus the customer's tag, credited after validation.
 * `reported`: the platform address for that network; the customer reports the transaction and staff confirm it.
 */
export type DepositInfo = {
  asset: string;
  mode: DepositMode;
  address: string;
  tag: string | null;
  memo: string | null;
  /** The network these details are for (its name and registry id), and every network the asset is accepted on. */
  network: string;
  networkId: string;
  networks: { id: string; name: string; open: boolean }[];
  testnet: boolean;
  minDrops: bigint;
};
export type LegalDoc = {
  id: LegalDocumentId;
  group: 'Account' | 'Custody & payments' | 'Products';
  name: string;
  version: string;
  requiresAcceptance: boolean;
  changeSummary: string | null;
  sections: [string, string][];
};
/** For a swap, `receiveUnits` is the amount of the bought asset (after the spread). */
export type FirmQuote = { quoteId: string; priceMicro: MicroUsd; feeCents: bigint; receiveCents: bigint; receiveUnits?: bigint; expiresAt: string };
/** Email and password are the whole sign-in: there is no second step. */
export type SignInResult = { status: 'ok' } | { status: 'error'; attemptsLeft: number; locked: boolean };
export type ProviderStatus = 'operational' | 'degraded' | 'outage';

/** Everything the app reads or writes. Money writes go through Edge Functions in the Supabase implementation. */
export type Api = {
  mode: 'demo' | 'supabase';
  now: () => Date;
  // Auth
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (input: { name: string; email: string; password: string; country: string; currency: string; updates: boolean }) => Promise<void>;
  signOut: () => Promise<void>;
  // Reads
  profile: () => Promise<CustomerProfile>;
  /** The customer's crypto trust, or null if they haven't created one yet. */
  trust: () => Promise<Trust | null>;
  createTrust: (input: TrustInput) => Promise<{ ref: string }>;
  assets: () => Promise<AssetInfo[]>;
  /** Balances for every asset the customer has touched. */
  holdings: () => Promise<Holding[]>;
  transactions: () => Promise<Transaction[]>;
  notifications: () => Promise<AppNotification[]>;
  depositInfo: (asset: string, network?: string) => Promise<DepositInfo>;
  loan: () => Promise<Loan | null>;
  yieldPositions: () => Promise<YieldPosition[]>;
  allowlist: () => Promise<AllowlistAddress[]>;
  devices: () => Promise<Device[]>;
  securityEvents: () => Promise<SecurityEvent[]>;
  tickets: () => Promise<SupportTicket[]>;
  legalDocuments: () => Promise<LegalDoc[]>;
  consents: () => Promise<Consent[]>;
  externalWallets: () => Promise<ExternalWallet[]>;
  custodyStatus: () => Promise<{ provider: ProviderStatus; reconciledAt: string; subAccount: string }>;
  // Writes (all money writes carry an idempotency key)
  markNotificationsRead: (ids?: string[]) => Promise<void>;
  reportDeposit: (input: { idempotencyKey: string; asset: string; network?: string; amountUnits: bigint; txHash: string; from: string | null }) => Promise<Transaction>;
  requestWithdrawal: (input: {
    idempotencyKey: string;
    asset: string;
    /** Registry network id; the asset's default network when omitted. */
    network?: string;
    memo: string | null;
    amountDrops: bigint;
    destination: string;
    destinationTag: string | null;
  }) => Promise<Transaction>;
  cancelWithdrawal: (id: string) => Promise<void>;
  /** Swap into another coin, or sell for USD (`toAsset` null) paid by bank transfer to `payout`. */
  requestExchange: (input: { idempotencyKey: string; asset: string; toAsset: string | null; payout?: BankPayout; amountDrops: bigint }) => Promise<Transaction>;
  acceptQuote: (txId: string, quoteId: string) => Promise<void>;
  requestNewQuote: (txId: string) => Promise<void>;
  cancelExchange: (txId: string) => Promise<void>;
  currentQuote: (txId: string) => Promise<FirmQuote | null>;
  allocateYield: (input: { idempotencyKey: string; asset: string; amountDrops: bigint }) => Promise<Transaction>;
  redeemYield: (input: { idempotencyKey: string; asset: string; amountDrops: bigint }) => Promise<Transaction>;
  /** The loan is paid by bank transfer to `payout` once Compliance approves it. */
  applyLoan: (input: { idempotencyKey: string; asset: string; collateralDrops: bigint; principalCents: bigint; payout: BankPayout }) => Promise<Transaction>;
  repayLoan: (input: { idempotencyKey: string; loanId: string; amountCents: bigint; via: 'bank' | 'sell' }) => Promise<Transaction>;
  addCollateral: (input: { idempotencyKey: string; loanId: string; amountDrops: bigint }) => Promise<Transaction>;
  setAllowlist: (enabled: boolean) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  addAllowlistAddress: (input: { asset: string; label: string; address: string; tag: string | null; memo?: string | null }) => Promise<void>;
  removeAllowlistAddress: (id: string) => Promise<void>;
  revokeDevice: (id: string) => Promise<void>;
  createTicket: (input: { topic: string; transactionRef: string | null; message: string; email?: string }) => Promise<SupportTicket>;
  acceptConsent: (doc: LegalDocumentId, version: string) => Promise<Consent>;
  setDisplayCurrency: (currency: string) => Promise<void>;
  /** Units of `currency` per US dollar, for display; null when no rate is known. */
  fxRate: (currency: string) => Promise<number | null>;
  /** Email receipts for deposits and withdrawals, and alerts when a held asset moves more than 5% in a day. */
  notificationPrefs: () => Promise<NotificationPrefs>;
  setNotificationPrefs: (change: Partial<NotificationPrefs>) => Promise<void>;
  addWatchWallet: (address: string, network?: string) => Promise<void>;
  addSelfCustodyWallet: (address: string) => Promise<void>;
  removeExternalWallet: (address: string, network?: string) => Promise<void>;
  /** Public balances of any address on a supported network (works before sign-in). */
  walletBalance: (network: string, address: string) => Promise<Record<string, bigint>>;
  // KYC
  kycStatus: () => Promise<KycStatus>;
  /** Starts the identity check and uploads every file (name → local file URI) to private storage. */
  submitKyc: (input: {
    documentType: 'passport' | 'national' | 'licence';
    country: string;
    addressDocument: 'bank' | 'utility';
    files: Record<string, { uri: string; type: string }>;
  }) => Promise<{ reference: string }>;
};
