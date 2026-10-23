/**
 * Supported assets. Amounts are bigint base units at the asset's ledger precision (`decimals`), capped at 8 so the
 * largest realistic balance fits a Postgres bigint. XRP keeps its native 6 (drops). Mirrored by `public.assets`.
 * Limits are in base units; the per-asset numbers target roughly the same USD value as the XRP originals.
 */
export type AssetId =
  | 'XRP' | 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'SOL' | 'BNB' | 'ADA' | 'DOGE'
  | 'TRX' | 'LTC' | 'AVAX' | 'DOT' | 'LINK' | 'XLM' | 'TON' | 'BCH' | 'POL';

/** How a deposit is matched to a customer: by destination tag/memo on the shared address, or reported by the customer and confirmed by staff. */
export type DepositMode = 'automatic' | 'reported';
export type MemoKind = 'tag' | 'memo' | null;

export type AssetSpec = {
  id: AssetId;
  name: string;
  network: string;
  decimals: number;
  /** CoinGecko id for live market data. */
  coingeckoId: string;
  /** Address format for withdrawals and allowlisting. */
  address: RegExp;
  addressHint: string;
  memo: MemoKind;
  deposit: DepositMode;
  minDeposit: string;
  minWithdrawal: string;
  withdrawalFee: string;
  /** Withdrawals above this need two approvals, one from Compliance. */
  approvalThreshold: string;
  /** Minimum for exchange, yield allocation and collateral top-ups. */
  minProduct: string;
  minCollateral: string;
  dailyLimit: string;
  /** Sample variable APR in bps for the Flexible yield product; null when not offered. */
  yieldAprBps: number | null;
  /** Accepted as loan collateral. */
  collateral: boolean;
  /** Seed for display-only sample charts when live data is unavailable. */
  seed: number;
};

const BASE58 = '[1-9A-HJ-NP-Za-km-z]';
const EVM = /^0x[0-9a-fA-F]{40}$/;

const spec = (s: Omit<AssetSpec, 'deposit'> & { deposit?: DepositMode }): AssetSpec => ({ deposit: 'reported', ...s });

export const ASSETS: readonly AssetSpec[] = [
  spec({ id: 'XRP', name: 'XRP', network: 'XRP Ledger', decimals: 6, coingeckoId: 'ripple', address: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, addressHint: 'Starts with “r”, 25–35 characters.', memo: 'tag', deposit: 'automatic', minDeposit: '10', minWithdrawal: '10', withdrawalFee: '0.25', approvalThreshold: '1000', minProduct: '50', minCollateral: '100', dailyLimit: '25000', yieldAprBps: 300, collateral: true, seed: 3 }),
  spec({ id: 'BTC', name: 'Bitcoin', network: 'Bitcoin', decimals: 8, coingeckoId: 'bitcoin', address: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/, addressHint: 'Starts with “bc1”, “1” or “3”.', memo: null, minDeposit: '0.0001', minWithdrawal: '0.0002', withdrawalFee: '0.00005', approvalThreshold: '0.03', minProduct: '0.001', minCollateral: '0.002', dailyLimit: '0.6', yieldAprBps: 150, collateral: true, seed: 5 }),
  spec({ id: 'ETH', name: 'Ethereum', network: 'Ethereum', decimals: 8, coingeckoId: 'ethereum', address: EVM, addressHint: 'Starts with “0x”, 42 characters.', memo: null, minDeposit: '0.005', minWithdrawal: '0.01', withdrawalFee: '0.002', approvalThreshold: '0.8', minProduct: '0.03', minCollateral: '0.06', dailyLimit: '15', yieldAprBps: 250, collateral: true, seed: 9 }),
  spec({ id: 'USDT', name: 'Tether', network: 'Tron (TRC-20)', decimals: 6, coingeckoId: 'tether', address: new RegExp(`^T${BASE58}{33}$`), addressHint: 'A Tron address: starts with “T”, 34 characters.', memo: null, minDeposit: '10', minWithdrawal: '20', withdrawalFee: '1', approvalThreshold: '2500', minProduct: '100', minCollateral: '250', dailyLimit: '60000', yieldAprBps: 600, collateral: true, seed: 11 }),
  spec({ id: 'USDC', name: 'USD Coin', network: 'Ethereum (ERC-20)', decimals: 6, coingeckoId: 'usd-coin', address: EVM, addressHint: 'Starts with “0x”, 42 characters.', memo: null, minDeposit: '10', minWithdrawal: '20', withdrawalFee: '3', approvalThreshold: '2500', minProduct: '100', minCollateral: '250', dailyLimit: '60000', yieldAprBps: 550, collateral: true, seed: 13 }),
  spec({ id: 'SOL', name: 'Solana', network: 'Solana', decimals: 8, coingeckoId: 'solana', address: new RegExp(`^${BASE58}{32,44}$`), addressHint: 'A Solana address: 32–44 characters.', memo: null, minDeposit: '0.05', minWithdrawal: '0.1', withdrawalFee: '0.01', approvalThreshold: '15', minProduct: '0.5', minCollateral: '1', dailyLimit: '350', yieldAprBps: 500, collateral: true, seed: 17 }),
  spec({ id: 'BNB', name: 'BNB', network: 'BNB Smart Chain (BEP-20)', decimals: 8, coingeckoId: 'binancecoin', address: EVM, addressHint: 'Starts with “0x”, 42 characters.', memo: null, minDeposit: '0.01', minWithdrawal: '0.02', withdrawalFee: '0.0005', approvalThreshold: '4', minProduct: '0.1', minCollateral: '0.2', dailyLimit: '90', yieldAprBps: 200, collateral: true, seed: 19 }),
  spec({ id: 'ADA', name: 'Cardano', network: 'Cardano', decimals: 6, coingeckoId: 'cardano', address: /^addr1[0-9a-z]{53,110}$/, addressHint: 'Starts with “addr1”.', memo: null, minDeposit: '10', minWithdrawal: '20', withdrawalFee: '1', approvalThreshold: '4000', minProduct: '150', minCollateral: '300', dailyLimit: '90000', yieldAprBps: 300, collateral: true, seed: 23 }),
  spec({ id: 'DOGE', name: 'Dogecoin', network: 'Dogecoin', decimals: 8, coingeckoId: 'dogecoin', address: new RegExp(`^D${BASE58}{25,34}$`), addressHint: 'Starts with “D”.', memo: null, minDeposit: '20', minWithdrawal: '50', withdrawalFee: '4', approvalThreshold: '12000', minProduct: '500', minCollateral: '1000', dailyLimit: '300000', yieldAprBps: 150, collateral: false, seed: 29 }),
  spec({ id: 'TRX', name: 'TRON', network: 'Tron', decimals: 6, coingeckoId: 'tron', address: new RegExp(`^T${BASE58}{33}$`), addressHint: 'Starts with “T”, 34 characters.', memo: null, minDeposit: '20', minWithdrawal: '50', withdrawalFee: '1', approvalThreshold: '10000', minProduct: '300', minCollateral: '600', dailyLimit: '250000', yieldAprBps: 400, collateral: false, seed: 31 }),
  spec({ id: 'LTC', name: 'Litecoin', network: 'Litecoin', decimals: 8, coingeckoId: 'litecoin', address: /^(ltc1[02-9ac-hj-np-z]{11,71}|[LM3][1-9A-HJ-NP-Za-km-z]{26,33})$/, addressHint: 'Starts with “ltc1”, “L” or “M”.', memo: null, minDeposit: '0.05', minWithdrawal: '0.1', withdrawalFee: '0.001', approvalThreshold: '25', minProduct: '1', minCollateral: '2', dailyLimit: '600', yieldAprBps: 150, collateral: true, seed: 37 }),
  spec({ id: 'AVAX', name: 'Avalanche', network: 'Avalanche C-Chain', decimals: 8, coingeckoId: 'avalanche-2', address: EVM, addressHint: 'Starts with “0x”, 42 characters.', memo: null, minDeposit: '0.1', minWithdrawal: '0.5', withdrawalFee: '0.01', approvalThreshold: '100', minProduct: '4', minCollateral: '8', dailyLimit: '2500', yieldAprBps: 450, collateral: false, seed: 41 }),
  spec({ id: 'DOT', name: 'Polkadot', network: 'Polkadot', decimals: 8, coingeckoId: 'polkadot', address: new RegExp(`^1${BASE58}{45,47}$`), addressHint: 'Starts with “1”, 47–48 characters.', memo: null, minDeposit: '1', minWithdrawal: '2', withdrawalFee: '0.1', approvalThreshold: '500', minProduct: '20', minCollateral: '40', dailyLimit: '12000', yieldAprBps: 1000, collateral: false, seed: 43 }),
  spec({ id: 'LINK', name: 'Chainlink', network: 'Ethereum (ERC-20)', decimals: 8, coingeckoId: 'chainlink', address: EVM, addressHint: 'Starts with “0x”, 42 characters.', memo: null, minDeposit: '0.5', minWithdrawal: '1', withdrawalFee: '0.2', approvalThreshold: '150', minProduct: '6', minCollateral: '12', dailyLimit: '3500', yieldAprBps: 350, collateral: false, seed: 47 }),
  spec({ id: 'XLM', name: 'Stellar', network: 'Stellar', decimals: 7, coingeckoId: 'stellar', address: /^G[A-Z2-7]{55}$/, addressHint: 'Starts with “G”, 56 characters.', memo: 'memo', minDeposit: '10', minWithdrawal: '20', withdrawalFee: '0.5', approvalThreshold: '8000', minProduct: '300', minCollateral: '600', dailyLimit: '200000', yieldAprBps: 200, collateral: false, seed: 53 }),
  spec({ id: 'TON', name: 'Toncoin', network: 'TON', decimals: 8, coingeckoId: 'the-open-network', address: /^(EQ|UQ)[A-Za-z0-9_-]{46}$/, addressHint: 'Starts with “EQ” or “UQ”, 48 characters.', memo: 'memo', minDeposit: '1', minWithdrawal: '2', withdrawalFee: '0.05', approvalThreshold: '600', minProduct: '20', minCollateral: '40', dailyLimit: '15000', yieldAprBps: 400, collateral: false, seed: 59 }),
  spec({ id: 'BCH', name: 'Bitcoin Cash', network: 'Bitcoin Cash', decimals: 8, coingeckoId: 'bitcoin-cash', address: /^((bitcoincash:)?[qp][a-z0-9]{41}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/, addressHint: 'Starts with “q”, “bitcoincash:” or “1”.', memo: null, minDeposit: '0.01', minWithdrawal: '0.02', withdrawalFee: '0.0005', approvalThreshold: '5', minProduct: '0.2', minCollateral: '0.4', dailyLimit: '120', yieldAprBps: null, collateral: false, seed: 61 }),
  spec({ id: 'POL', name: 'Polygon', network: 'Polygon PoS', decimals: 8, coingeckoId: 'polygon-ecosystem-token', address: EVM, addressHint: 'Starts with “0x”, 42 characters.', memo: null, minDeposit: '5', minWithdrawal: '10', withdrawalFee: '0.1', approvalThreshold: '10000', minProduct: '300', minCollateral: '600', dailyLimit: '250000', yieldAprBps: 350, collateral: false, seed: 67 }),
];

export const ASSET_IDS = ASSETS.map((a) => a.id);
export const isAssetId = (v: string): v is AssetId => (ASSET_IDS as string[]).includes(v);

export const asset = (id: string): AssetSpec => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new RangeError(`Unknown asset: ${id}`);
  return a;
};

/** Base units per whole coin, e.g. 100_000_000n for BTC. */
export const unitScale = (id: string): bigint => 10n ** BigInt(asset(id).decimals);

export const isAssetAddress = (id: string, value: string): boolean => asset(id).address.test(value.trim());

/** Decimals shown by default in balances and lists (full precision is shown where it matters, e.g. withdrawal receive). */
const DISPLAY: Partial<Record<AssetId, number>> = { BTC: 6, ETH: 5, BNB: 4, LTC: 4, BCH: 4, SOL: 3, AVAX: 3, DOT: 3, LINK: 3, TON: 3 };
export const displayDecimals = (id: string): number => DISPLAY[id as AssetId] ?? 2;
