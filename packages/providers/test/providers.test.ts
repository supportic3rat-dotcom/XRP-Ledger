import { describe, expect, it } from 'vitest';
import { chartPeriods, createCoinGecko, createMockProviders, providerNames, sampleSeries } from '../src/index.ts';

describe('provider mocks', () => {
  it('name the platform’s own services, with no bracket placeholders left', () => {
    for (const name of Object.values(providerNames)) expect(name).not.toMatch(/[[\]]/);
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

describe('live quotes', () => {
  const nowSec = () => Math.floor(Date.now() / 1000);
  const feed = (body: unknown) => createCoinGecko({ fetch: (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch });

  it('quote a swap at the live prices of both coins', async () => {
    const cg = feed({ ripple: { usd: 1.32, last_updated_at: nowSec() }, tether: { usd: 0.9991, last_updated_at: nowSec() } });
    const q = await cg.requestQuote({ amountDrops: 500_000_000n, asset: 'XRP', toAsset: 'USDT' });
    expect([q.priceMicro, q.toPriceMicro]).toEqual([1_320_000n, 999_100n]);
    expect(Date.parse(q.expiresAt)).toBeGreaterThan(Date.now());
  });
  it('refuse to quote on a stale price', async () => {
    const cg = feed({ ripple: { usd: 1.32, last_updated_at: nowSec() - 60 * 60 } });
    await expect(cg.requestQuote({ amountDrops: 1n, asset: 'XRP' })).rejects.toThrow(/no current price for XRP/);
  });
  it('refuse to quote when a coin has no price', async () => {
    const cg = feed({ ripple: { usd: 1.32, last_updated_at: nowSec() } });
    await expect(cg.requestQuote({ amountDrops: 1n, asset: 'XRP', toAsset: 'BTC' })).rejects.toThrow(/no current price for BTC/);
  });
});
