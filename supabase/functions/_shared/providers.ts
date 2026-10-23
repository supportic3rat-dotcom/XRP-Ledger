import { createCoinGecko, createMockProviders, type Providers } from '@xrp/providers';

/**
 * Provider adapters. Custody, KYC, liquidity, yield and lending are still placeholders ([Custody provider], …), so
 * those return the mocks. Market data is public, so prices and chart history come live from CoinGecko unless
 * MARKET_DATA=mock (an optional COINGECKO_API_KEY raises the rate limit).
 */
export const providers = (): Providers => {
  const mocks = createMockProviders({ latencyMs: 0 });
  if (Deno.env.get('MARKET_DATA') === 'mock') return mocks;
  const cg = createCoinGecko({ apiKey: Deno.env.get('COINGECKO_API_KEY') ?? undefined, pro: Deno.env.get('COINGECKO_PRO') === '1' });
  return { ...mocks, prices: cg.feed };
};
