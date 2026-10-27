import { describe, expect, it } from 'vitest';
import {
  assetNetwork,
  ASSETS,
  assetLimits,
  centsToUnits,
  convertUnits,
  formatAmount,
  formatAssetPrice,
  isAssetAddress,
  ltvBps,
  parseUnits,
  swapEstimate,
  thresholdPrice,
  unitsToCents,
  usdToMicro,
  withdrawalReceiveFor,
  xrpToDrops,
} from '../src/index.ts';

describe('asset registry', () => {
  it('keeps ledger precision at 8 or fewer decimals so balances fit a bigint column', () => {
    for (const a of ASSETS) expect(a.decimals).toBeLessThanOrEqual(8);
  });
  it('matches the XRP constants for XRP limits', () => {
    expect(assetLimits('XRP').withdrawalFee).toBe(250_000n);
    expect(assetLimits('XRP').approvalThreshold).toBe(xrpToDrops('1000'));
  });
  it('validates addresses per network', () => {
    expect(isAssetAddress('BTC', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
    expect(isAssetAddress('ETH', '0x52908400098527886E0F7030069857D2E4169EE7')).toBe(true);
    expect(isAssetAddress('ETH', 'rExtProtoWa11et9xQb7mKcV9tYwZ2')).toBe(false);
    expect(isAssetAddress('USDT', 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL')).toBe(true);
  });
});

describe('multi-asset money', () => {
  it('parses at the asset precision and refuses extra decimals', () => {
    expect(parseUnits('0.00000001', 'BTC')).toBe(1n);
    expect(parseUnits('0.0000001', 'XRP')).toBeNull();
  });
  it('values any asset in cents', () => {
    expect(unitsToCents(parseUnits('0.5', 'BTC')!, usdToMicro('98000'), 'BTC')).toBe(4_900_000n);
    expect(centsToUnits(4_900_000n, usdToMicro('98000'), 'BTC')).toBe(50_000_000n);
  });
  it('converts between assets through USD', () => {
    const btc = { asset: 'BTC', price: usdToMicro('100000') };
    const xrp = { asset: 'XRP', price: usdToMicro('2.5') };
    expect(convertUnits(parseUnits('0.01', 'BTC')!, btc, xrp)).toBe(xrpToDrops('400'));
    expect(swapEstimate(parseUnits('0.01', 'BTC')!, btc, xrp).receive).toBe(xrpToDrops('396'));
  });
  it('formats with the asset’s display decimals', () => {
    expect(formatAmount(12_345_678n, 'BTC')).toBe('0.123457 BTC');
    expect(formatAmount(xrpToDrops('6420.1'), 'XRP')).toBe('6,420.10 XRP');
    expect(formatAssetPrice(usdToMicro('0.000012'))).toBe('$0.000012');
  });
  it('computes LTV and thresholds for 8-decimal collateral', () => {
    const one = parseUnits('1', 'ETH')!;
    expect(ltvBps(150_000n, one, usdToMicro('3000'), 8)).toBe(5000);
    expect(thresholdPrice(150_000n, one, 8000, 8)).toBe(usdToMicro('1875'));
  });
  it('deducts the per-asset withdrawal fee', () => {
    expect(withdrawalReceiveFor('BTC', parseUnits('0.001', 'BTC')!)).toBe(95_000n);
  });
});

describe('networks', () => {
  const EVM = '0xc33B5D681Fdf4986921123f34156D6957Ab60656';
  it('lists the owner’s 18 coins, with USDT, USDC and POL on two networks', () => {
    expect(ASSETS).toHaveLength(18);
    expect(ASSETS.filter((a) => a.networks.length > 1).map((a) => a.id)).toEqual(['USDT', 'USDC', 'POL']);
  });
  it('checks an address against the chosen network, or any network without one', () => {
    expect(isAssetAddress('USDT', EVM)).toBe(true);
    expect(isAssetAddress('USDT', EVM, 'ethereum')).toBe(true);
    expect(isAssetAddress('USDT', EVM, 'tron')).toBe(false);
    expect(isAssetAddress('USDT', 'TLriwtKfzQkth9uLtmWXcghCSvNqj28Kns', 'tron')).toBe(true);
  });
  it('falls back to the default network for an unknown id', () => {
    expect(assetNetwork('USDC').id).toBe('ethereum');
    expect(assetNetwork('USDC', 'solana').name).toBe('Solana (SPL)');
    expect(assetNetwork('BTC', 'nope').id).toBe('bitcoin');
  });
});
