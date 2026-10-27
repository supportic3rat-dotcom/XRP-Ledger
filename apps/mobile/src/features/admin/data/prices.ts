import { ASSET_IDS } from '@xrp/ledger';
import { createCoinGecko, MOCK_PRICES } from '@xrp/providers';

export type PriceRow = { priceMicro: bigint; changeBps: number; at: string; live: boolean };

const cg = createCoinGecko({ apiKey: process.env.EXPO_PUBLIC_COINGECKO_API_KEY });
let cache: { fetchedAt: number; rows: Map<string, PriceRow> } | null = null;

/**
 * Latest USD price per asset for valuing balances in the console: live from CoinGecko, cached for a minute.
 * Falls back to sample prices (marked `live: false`) if the market data API can't be reached.
 */
export const livePrices = async (): Promise<Map<string, PriceRow>> => {
  if (cache && Date.now() - cache.fetchedAt < 60_000) return cache.rows;
  try {
    const list = await cg.prices(ASSET_IDS);
    if (list.length) {
      const rows = new Map(list.map((p) => [p.asset, { priceMicro: p.priceMicro, changeBps: p.changeBps, at: p.at, live: true }]));
      cache = { fetchedAt: Date.now(), rows };
      return rows;
    }
  } catch {
    /* fall back below */
  }
  return new Map(Object.entries(MOCK_PRICES).map(([a, p]) => [a, { priceMicro: p, changeBps: 0, at: new Date().toISOString(), live: false }]));
};
