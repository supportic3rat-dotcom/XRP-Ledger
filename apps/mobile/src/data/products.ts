import { asset as assetSpec, assetLimits, xrpToDrops } from '@xrp/ledger';

export type FlexibleProduct = {
  asset: string;
  name: string;
  provider: string;
  aprBps: number;
  feeBps: number;
  minDrops: bigint;
  lockUp: string;
  withdrawal: string;
  eligibility: string;
  rateUpdatedAt: string;
  termsVersion: string;
};

/** Flexible yield product for an asset (sample terms from [Yield provider]; labelled variable and sample in the UI). Null if none. */
export const flexibleProduct = (asset: string, aprBps?: number | null): FlexibleProduct | null => {
  const a = assetSpec(asset);
  const apr = aprBps === undefined ? a.yieldAprBps : aprBps;
  if (apr === null) return null;
  return {
    asset,
    name: `${a.id} Flexible`,
    provider: '[Yield provider]',
    aprBps: apr,
    feeBps: 1000,
    minDrops: assetLimits(asset).minProduct,
    lockUp: 'None',
    withdrawal: '1–2 business days',
    eligibility: 'Verified · agreement signed',
    rateUpdatedAt: '2026-10-19T08:00:00Z',
    termsVersion: 'v0.1',
  };
};

/** The XRP product (kept for screens that only show XRP). */
export const xrpFlexible = flexibleProduct('XRP') as FlexibleProduct;

export const lendingTerms = {
  provider: '[Lending provider]',
  aprBps: 1000,
  maxStartLtvBps: 5000,
  originationBps: 100,
  minCollateralDrops: xrpToDrops('100'),
  minLoanCents: 10_000n,
  agreementVersion: 'v0.1',
} as const;
