import type { Cents, Drops, MicroUsd } from '@xrp/types';

export type ProviderHealth = { status: 'operational' | 'degraded' | 'outage'; note: string };

/** Display names stay as placeholders until a provider is chosen. */
export const providerNames = {
  custody: '[Custody provider]',
  kyc: '[KYC provider]',
  screening: '[Screening provider]',
  liquidity: '[Liquidity provider]',
  payout: '[Bank / payout provider]',
  yield: '[Yield provider]',
  lending: '[Lending provider]',
  prices: '[Market data provider]',
} as const;

export type CustodyWallet = { id: string; tier: 'hot' | 'warm' | 'cold'; address: string; balanceDrops: Drops };
export type CustodyTransfer = { id: string; status: 'pending' | 'submitted' | 'validated' | 'failed'; ledgerHash: string | null; ledgerIndex: number | null };
export interface CustodyProvider {
  health(): Promise<ProviderHealth>;
  listWallets(): Promise<CustodyWallet[]>;
  getBalances(): Promise<{ totalDrops: Drops }>;
  requestWithdrawal(input: {
    idempotencyKey: string;
    destination: string;
    destinationTag: number | null;
    amountDrops: Drops;
    lastLedgerSequence: number;
  }): Promise<CustodyTransfer>;
  getTransfer(id: string): Promise<CustodyTransfer>;
}

export type KycDecision = 'in_progress' | 'more_info' | 'verified' | 'rejected';
export interface KycProvider {
  createSession(input: { customerId: string; documentType: string; country: string }): Promise<{ sessionId: string; uploadUrls: Record<string, string> }>;
  getResult(sessionId: string): Promise<{ decision: KycDecision; reason?: string }>;
  verifyWebhook(rawBody: string, signature: string): Promise<boolean>;
}

export type ScreeningResult = { risk: 'low' | 'medium' | 'high'; hold: boolean; reference: string };
export interface ScreeningProvider {
  screenAddress(address: string): Promise<ScreeningResult>;
  screenTransfer(input: { address: string; amountDrops: Drops; direction: 'in' | 'out' }): Promise<ScreeningResult>;
}

/** `priceMicro` is the USD price of the asset sold; for a swap, `toPriceMicro` is the price of the asset bought. */
export type FirmQuote = { quoteId: string; priceMicro: MicroUsd; toPriceMicro?: MicroUsd; expiresAt: string };
export interface LiquidityProvider {
  /** `asset` defaults to XRP; `toAsset` set means a swap into that asset rather than a sale for USD. */
  requestQuote(input: { amountDrops: Drops; asset?: string; toAsset?: string | null }): Promise<FirmQuote>;
  executeQuote(quoteId: string): Promise<{ executionId: string; proceedsCents: Cents }>;
}

export interface PayoutProvider {
  createPayout(input: { idempotencyKey: string; amountCents: Cents; accountRef: string }): Promise<{ payoutId: string }>;
  getPayout(payoutId: string): Promise<{ status: 'pending' | 'settled' | 'failed' }>;
}

export interface YieldProvider {
  allocate(input: { idempotencyKey: string; amountDrops: Drops; asset?: string }): Promise<{ requestId: string }>;
  redeem(input: { idempotencyKey: string; amountDrops: Drops; asset?: string }): Promise<{ requestId: string }>;
  getStatement(period: { from: string; to: string }): Promise<{ grossDrops: Drops; lines: { customerRef: string; grossDrops: Drops }[] }>;
}

export interface LendingProvider {
  apply(input: { idempotencyKey: string; collateralDrops: Drops; principalCents: Cents; asset?: string }): Promise<{ applicationId: string }>;
  fund(applicationId: string): Promise<{ loanId: string }>;
  getLoan(loanId: string): Promise<{ status: string; owedCents: Cents }>;
  liquidate(loanId: string): Promise<{ accepted: boolean }>;
}

export type PricePoint = { at: string; priceMicro: MicroUsd };
export interface PriceFeed {
  getPrice(asset: string): Promise<{ priceMicro: MicroUsd; at: string; source: string }>;
  getHistory(asset: string, period: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'): Promise<PricePoint[]>;
}

export type Providers = {
  custody: CustodyProvider;
  kyc: KycProvider;
  screening: ScreeningProvider;
  liquidity: LiquidityProvider;
  payout: PayoutProvider;
  yield: YieldProvider;
  lending: LendingProvider;
  prices: PriceFeed;
};
