import { describe, expect, it } from 'vitest';
import { chartPeriods, createMockProviders, providerNames, sampleSeries } from '../src/index.ts';

describe('provider mocks', () => {
  it('keep placeholder names until a provider is chosen', () => {
    for (const name of Object.values(providerNames)) expect(name).toMatch(/^\[.+\]$/);
  });
  it('return integer amounts (bigint) for balances and prices', async () => {
    const p = createMockProviders({ latencyMs: 0 });
    const price = await p.prices.getPrice('XRP');
    expect(typeof price.priceMicro).toBe('bigint');
    for (const w of await p.custody.listWallets()) expect(typeof w.balanceDrops).toBe('bigint');
  });
  it('quotes expire in the future', async () => {
    const q = await createMockProviders({ latencyMs: 0 }).liquidity.requestQuote({ amountDrops: 500_000_000n });
    expect(Date.parse(q.expiresAt)).toBeGreaterThan(Date.now());
  });
  it('generates the same chart series for the same seed', () => {
    const spec = chartPeriods[2]!;
    expect(sampleSeries(spec, 2.38, 7, 0.05)).toEqual(sampleSeries(spec, 2.38, 7, 0.05));
  });
});
