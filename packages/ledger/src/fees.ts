import type { Cents, Drops, MicroUsd } from '@xrp/types';
import { asset } from './assets.ts';
import { convertUnits, dropsToCents, toUnits, unitsToCents } from './money.ts';
import { percentOf } from './risk.ts';

export const WITHDRAWAL_FEE_DROPS: Drops = 250_000n; // 0.25 XRP
export const NETWORK_FEE_ESTIMATE_DROPS: Drops = 12n; // 0.000012 XRP
export const MIN_WITHDRAWAL_DROPS: Drops = 10_000_000n;
export const MIN_DEPOSIT_DROPS: Drops = 10_000_000n;
export const TWO_APPROVAL_THRESHOLD_DROPS: Drops = 1_000_000_000n; // 1,000 XRP
export const MIN_EXCHANGE_DROPS: Drops = 50_000_000n;
export const EXCHANGE_FEE_BPS = 100; // spread & service fee 1.00%
export const PAYOUT_FEE_CENTS: Cents = 150n;
export const MIN_YIELD_DROPS: Drops = 50_000_000n;
export const YIELD_FEE_BPS = 1000;
export const MIN_COLLATERAL_TOPUP_DROPS: Drops = 50_000_000n;
export const MIN_LOAN_COLLATERAL_DROPS: Drops = 100_000_000n;
export const MIN_LOAN_CENTS: Cents = 10_000n;
export const ORIGINATION_FEE_BPS = 100;

/** What the recipient gets after the platform fee and the estimated network fee. */
export const withdrawalReceive = (amount: Drops): Drops => {
  const receive = amount - WITHDRAWAL_FEE_DROPS - NETWORK_FEE_ESTIMATE_DROPS;
  return receive > 0n ? receive : 0n;
};

export type ExchangeEstimate = { gross: Cents; fee: Cents; payout: Cents; receive: Cents };
export const exchangeEstimate = (amount: Drops, price: MicroUsd): ExchangeEstimate => {
  const gross = dropsToCents(amount, price);
  const fee = percentOf(gross, EXCHANGE_FEE_BPS);
  const receive = gross - fee - PAYOUT_FEE_CENTS;
  return { gross, fee, payout: PAYOUT_FEE_CENTS, receive: receive > 0n ? receive : 0n };
};

export const needsTwoApprovals = (amount: Drops): boolean => amount > TWO_APPROVAL_THRESHOLD_DROPS;

export type AssetLimits = {
  minDeposit: bigint;
  minWithdrawal: bigint;
  withdrawalFee: bigint;
  approvalThreshold: bigint;
  minProduct: bigint;
  minCollateral: bigint;
  dailyLimit: bigint;
};
/** Per-asset limits in base units, from the asset registry (XRP's match the constants above). */
export const assetLimits = (id: string): AssetLimits => {
  const a = asset(id);
  const u = (v: string) => toUnits(v, id);
  return {
    minDeposit: u(a.minDeposit),
    minWithdrawal: u(a.minWithdrawal),
    withdrawalFee: u(a.withdrawalFee),
    approvalThreshold: u(a.approvalThreshold),
    minProduct: u(a.minProduct),
    minCollateral: u(a.minCollateral),
    dailyLimit: u(a.dailyLimit),
  };
};

/** Network fee estimate in base units: XRP's is known; other networks are paid by the platform from the withdrawal fee. */
export const networkFeeEstimate = (id: string): bigint => (id === 'XRP' ? NETWORK_FEE_ESTIMATE_DROPS : 0n);

/** What the recipient gets after the platform fee and the estimated network fee, for any asset. */
export const withdrawalReceiveFor = (id: string, amount: bigint): bigint => {
  const receive = amount - assetLimits(id).withdrawalFee - networkFeeEstimate(id);
  return receive > 0n ? receive : 0n;
};

/** Sell any asset for USD: gross at the price, less the spread and the bank payout fee. */
export const exchangeEstimateFor = (id: string, amount: bigint, price: MicroUsd): ExchangeEstimate => {
  const gross = unitsToCents(amount, price, id);
  const fee = percentOf(gross, EXCHANGE_FEE_BPS);
  const receive = gross - fee - PAYOUT_FEE_CENTS;
  return { gross, fee, payout: PAYOUT_FEE_CENTS, receive: receive > 0n ? receive : 0n };
};

export type SwapEstimate = { gross: bigint; fee: bigint; receive: bigint };
/** Swap one asset for another: converted at the two prices, with the spread taken from what you receive. */
export const swapEstimate = (amount: bigint, from: { asset: string; price: MicroUsd }, to: { asset: string; price: MicroUsd }): SwapEstimate => {
  const gross = convertUnits(amount, from, to);
  const fee = percentOf(gross, EXCHANGE_FEE_BPS);
  return { gross, fee, receive: gross - fee };
};
