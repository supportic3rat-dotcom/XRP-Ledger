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
} from '@xrp/types';

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
  network: string;
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
/** `ok`: signed in without a second step (no authenticator set up yet). */
export type SignInResult = { status: 'ok' } | { status: 'mfa_required' } | { status: 'error'; attemptsLeft: number; locked: boolean };
export type ProviderStatus = 'operational' | 'degraded' | 'outage';

/** Everything the app reads or writes. Money writes go through Edge Functions in the Supabase implementation. */
export type Api = {
  mode: 'demo' | 'supabase';
  now: () => Date;
  // Auth
  signIn: (email: string, password: string) => Promise<SignInResult>;
  verifyMfa: (code: string, backup: boolean) => Promise<{ ok: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string; country: string; currency: string; updates: boolean }) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<{ ok: boolean }>;
  resendEmailCode: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Reads
  profile: () => Promise<CustomerProfile>;
  assets: () => Promise<AssetInfo[]>;
  /** Balances for every asset the customer has touched. */
  holdings: () => Promise<Holding[]>;
  transactions: () => Promise<Transaction[]>;
  notifications: () => Promise<AppNotification[]>;
  depositInfo: (asset: string) => Promise<DepositInfo>;
  loan: () => Promise<Loan | null>;
  yieldPositions: () => Promise<YieldPosition[]>;
  allowlist: () => Promise<AllowlistAddress[]>;
  devices: () => Promise<Device[]>;
  securityEvents: () => Promise<SecurityEvent[]>;
  backupCodes: () => Promise<{ codes: string[]; unused: number }>;
  tickets: () => Promise<SupportTicket[]>;
  legalDocuments: () => Promise<LegalDoc[]>;
  consents: () => Promise<Consent[]>;
  externalWallets: () => Promise<ExternalWallet[]>;
  custodyStatus: () => Promise<{ provider: ProviderStatus; reconciledAt: string; subAccount: string }>;
  // Writes (all money writes carry an idempotency key)
  markNotificationsRead: (ids?: string[]) => Promise<void>;
  reportDeposit: (input: { idempotencyKey: string; asset: string; amountUnits: bigint; txHash: string; from: string | null }) => Promise<Transaction>;
  requestWithdrawal: (input: {
    idempotencyKey: string;
    asset: string;
    memo: string | null;
    amountDrops: bigint;
    destination: string;
    destinationTag: string | null;
    totpCode: string;
  }) => Promise<Transaction>;
  cancelWithdrawal: (id: string) => Promise<void>;
  /** Sell for USD (`toAsset` null) or swap into another asset. */
  requestExchange: (input: { idempotencyKey: string; asset: string; toAsset: string | null; amountDrops: bigint }) => Promise<Transaction>;
  acceptQuote: (txId: string, quoteId: string) => Promise<void>;
  requestNewQuote: (txId: string) => Promise<void>;
  cancelExchange: (txId: string) => Promise<void>;
  currentQuote: (txId: string) => Promise<FirmQuote | null>;
  allocateYield: (input: { idempotencyKey: string; asset: string; amountDrops: bigint }) => Promise<Transaction>;
  redeemYield: (input: { idempotencyKey: string; asset: string; amountDrops: bigint }) => Promise<Transaction>;
  applyLoan: (input: { idempotencyKey: string; asset: string; collateralDrops: bigint; principalCents: bigint }) => Promise<Transaction>;
  repayLoan: (input: { idempotencyKey: string; loanId: string; amountCents: bigint; via: 'bank' | 'sell' }) => Promise<Transaction>;
  addCollateral: (input: { idempotencyKey: string; loanId: string; amountDrops: bigint }) => Promise<Transaction>;
  setTwoFactor: (enabled: boolean) => Promise<void>;
  /** Starts authenticator setup. Null when no setup is needed (demo mode, or a factor already exists). */
  startTotpEnrollment: () => Promise<{ factorId: string; uri: string; secret: string } | null>;
  confirmTotpEnrollment: (factorId: string, code: string) => Promise<{ ok: boolean }>;
  setAllowlist: (enabled: boolean) => Promise<void>;
  regenerateBackupCodes: () => Promise<string[]>;
  changePassword: (current: string, next: string) => Promise<void>;
  addAllowlistAddress: (input: { asset: string; label: string; address: string; tag: string | null; memo?: string | null }) => Promise<void>;
  removeAllowlistAddress: (id: string) => Promise<void>;
  revokeDevice: (id: string) => Promise<void>;
  createTicket: (input: { topic: string; transactionRef: string | null; message: string; email?: string }) => Promise<SupportTicket>;
  acceptConsent: (doc: LegalDocumentId, version: string) => Promise<Consent>;
  setDisplayCurrency: (currency: string) => Promise<void>;
  addWatchWallet: (address: string) => Promise<void>;
  addSelfCustodyWallet: (address: string) => Promise<void>;
  removeExternalWallet: (address: string) => Promise<void>;
  // KYC
  kycStatus: () => Promise<KycStatus>;
  submitKyc: (input: {
    documentType: 'passport' | 'national' | 'licence';
    country: string;
    addressDocument: 'bank' | 'utility';
  }) => Promise<{ reference: string }>;
};
