import { createCoinGecko, createMockProviders, type Providers } from '@xrp/providers';

/**
 * Provider adapters. Custody, KYC, yield and lending are still placeholders ([Custody provider], …), so those return
 * the mocks. Market data is public, so prices, chart history and exchange quotes come from the live feed (quotes at
 * live prices; the platform spread is applied in _shared/quotes.ts). MARKET_DATA=mock switches all of it to sample
 * prices for development only (an optional COINGECKO_API_KEY raises the rate limit).
 */
export const providers = (): Providers => {
  const mocks = createMockProviders({ latencyMs: 0 });
  const cg = liveMarketData();
  if (!cg) return mocks;
  return { ...mocks, prices: cg.feed, liquidity: { ...mocks.liquidity, requestQuote: cg.requestQuote } };
};

/** The live market data client, or null when MARKET_DATA=mock. */
export const liveMarketData = () =>
  Deno.env.get('MARKET_DATA') === 'mock'
    ? null
    : createCoinGecko({ apiKey: Deno.env.get('COINGECKO_API_KEY') ?? undefined, pro: Deno.env.get('COINGECKO_PRO') === '1' });
