import type { Bps, Cents, Drops, MicroUsd } from '@xrp/types';
import { divRound } from './money.ts';

export const MARGIN_CALL_BPS: Bps = 6500;
export const LIQUIDATION_BPS: Bps = 8000;
export const ALERT_BPS: Bps = 5500;
export const MAX_START_LTV_BPS: Bps = 5000;

/** LTV in basis points: owed ÷ (collateral × price). `decimals` is the collateral asset's precision (XRP: 6). */
export const ltvBps = (owed: Cents, collateral: Drops, price: MicroUsd, decimals = 6): Bps => {
  const value = collateral * price; // 10^-(decimals+6) USD
  if (value === 0n) return 0;
  return Number(divRound(owed * 10n ** BigInt(decimals + 4) * 10_000n, value));
};

/** Price (micro-USD) at which LTV reaches the threshold: owed ÷ (collateral × threshold). */
export const thresholdPrice = (owed: Cents, collateral: Drops, thresholdBps: Bps, decimals = 6): MicroUsd => {
  if (collateral === 0n) return 0n;
  return divRound(owed * 10_000n * 10_000n * 10n ** BigInt(decimals), collateral * BigInt(thresholdBps));
};

export type LtvLevel = 'ok' | 'watch' | 'call' | 'liq';
export const ltvLevel = (bps: Bps): LtvLevel => {
  if (bps >= LIQUIDATION_BPS) return 'liq';
  if (bps >= MARGIN_CALL_BPS) return 'call';
  if (bps >= ALERT_BPS) return 'watch';
  return 'ok';
};

/** "33.9%" */
export const formatBps = (bps: Bps, decimals = 1): string => `${(bps / 100).toFixed(decimals)}%`;

/** Simple interest for a period: principal × apr × days ÷ 365, half-up. */
export const simpleInterest = (principal: bigint, aprBps: Bps, days: number): bigint => divRound(principal * BigInt(aprBps) * BigInt(days), 10_000n * 365n);

/** A percentage of an amount, half-up. */
export const percentOf = (amount: bigint, bps: Bps): bigint => divRound(amount * BigInt(bps), 10_000n);
