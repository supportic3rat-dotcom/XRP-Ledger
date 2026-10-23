import { ASSETS, asset } from '@xrp/ledger';
import type { MicroUsd } from '@xrp/types';
import type { PriceFeed, PricePoint } from './interfaces.ts';
import type { ChartPeriod } from './series.ts';

/**
 * Live market data from CoinGecko (public API; an optional demo/pro key raises the rate limit).
 * Prices are converted to micro-USD bigints at the edge so nothing downstream does money math on floats.
 * Display statistics (market cap, volume, supply) stay as numbers: they are never used for money.
 */
export type CoinGeckoOptions = { apiKey?: string; pro?: boolean; fetch?: typeof fetch; timeoutMs?: number };

export type MarketStats = {
  asset: string;
  priceMicro: MicroUsd;
  /** 24h change in basis points. */
  changeBps: number;
  change7dBps: number | null;
  marketCapUsd: number;
  volume24hUsd: number;
  high24hMicro: MicroUsd;
  low24hMicro: MicroUsd;
  athMicro: MicroUsd;
  athDate: string | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  rank: number | null;
  /** Hourly prices for the last 7 days, oldest first. */
  sparkline: number[];
  updatedAt: string;
};

const PERIOD_DAYS: Record<ChartPeriod, string> = { '1D': '1', '1W': '7', '1M': '30', '3M': '90', '6M': '180', '1Y': '365', ALL: 'max' };

export const toMicro = (usd: number): MicroUsd => BigInt(Math.max(0, Math.round(usd * 1_000_000)));

/** Evenly samples a series down to at most `max` points, always keeping the last. */
export const downsample = <T>(points: readonly T[], max: number): T[] => {
  if (points.length <= max) return [...points];
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)] as T);
};

export const createCoinGecko = (opts: CoinGeckoOptions = {}) => {
  const base = opts.pro ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
  const doFetch = opts.fetch ?? fetch;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.apiKey) headers[opts.pro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = opts.apiKey;

  const get = async <T>(path: string): Promise<T> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
    try {
      const res = await doFetch(`${base}${path}`, { headers, signal: ctrl.signal });
      if (!res.ok) throw new Error(`Market data unavailable (${res.status})`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  };

  const idFor = (assetId: string) => asset(assetId).coingeckoId;
  const byGecko = new Map(ASSETS.map((a) => [a.coingeckoId, a.id]));

  type MarketRow = {
    id: string;
    current_price: number | null;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d_in_currency?: number | null;
    market_cap: number | null;
    total_volume: number | null;
    high_24h: number | null;
    low_24h: number | null;
    ath: number | null;
    ath_date: string | null;
    circulating_supply: number | null;
    max_supply: number | null;
    market_cap_rank: number | null;
    sparkline_in_7d?: { price: number[] } | null;
    last_updated: string | null;
  };

  /** Market overview for the given assets (all supported assets by default), in the order requested. */
  const markets = async (assetIds: readonly string[] = ASSETS.map((a) => a.id)): Promise<MarketStats[]> => {
    const ids = assetIds.map(idFor).join(',');
    const rows = await get<MarketRow[]>(`/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h,7d&per_page=250`);
    const out = rows
      .filter((r) => byGecko.has(r.id) && r.current_price !== null)
      .map((r) => ({
        asset: byGecko.get(r.id) as string,
        priceMicro: toMicro(r.current_price ?? 0),
        changeBps: Math.round((r.price_change_percentage_24h ?? 0) * 100),
        change7dBps: r.price_change_percentage_7d_in_currency == null ? null : Math.round(r.price_change_percentage_7d_in_currency * 100),
        marketCapUsd: r.market_cap ?? 0,
        volume24hUsd: r.total_volume ?? 0,
        high24hMicro: toMicro(r.high_24h ?? 0),
        low24hMicro: toMicro(r.low_24h ?? 0),
        athMicro: toMicro(r.ath ?? 0),
        athDate: r.ath_date,
        circulatingSupply: r.circulating_supply,
        maxSupply: r.max_supply,
        rank: r.market_cap_rank,
        sparkline: downsample(r.sparkline_in_7d?.price ?? [], 48),
        updatedAt: r.last_updated ?? new Date().toISOString(),
      }));
    return assetIds.map((id) => out.find((m) => m.asset === id)).filter((m): m is MarketStats => !!m);
  };

  /** Price history for a chart period, downsampled to at most `points` points. */
  const history = async (assetId: string, period: ChartPeriod, points = 90): Promise<PricePoint[]> => {
    const data = await get<{ prices: [number, number][] }>(`/coins/${idFor(assetId)}/market_chart?vs_currency=usd&days=${PERIOD_DAYS[period]}`);
    return downsample(data.prices, points).map(([t, p]) => ({ at: new Date(t).toISOString(), priceMicro: toMicro(p) }));
  };

  /** Latest prices for many assets in one call (used by the price recorder). */
  const prices = async (assetIds: readonly string[] = ASSETS.map((a) => a.id)): Promise<{ asset: string; priceMicro: MicroUsd; changeBps: number; at: string }[]> => {
    const data = await get<Record<string, { usd?: number; usd_24h_change?: number; last_updated_at?: number }>>(
      `/simple/price?ids=${assetIds.map(idFor).join(',')}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
    );
    return assetIds.flatMap((id) => {
      const row = data[idFor(id)];
      if (!row?.usd) return [];
      return [{
        asset: id,
        priceMicro: toMicro(row.usd),
        changeBps: Math.round((row.usd_24h_change ?? 0) * 100),
        at: row.last_updated_at ? new Date(row.last_updated_at * 1000).toISOString() : new Date().toISOString(),
      }];
    });
  };

  const feed: PriceFeed = {
    getPrice: async (assetId) => {
      const [p] = await prices([assetId]);
      if (!p) throw new Error(`No price for ${assetId}`);
      return { priceMicro: p.priceMicro, at: p.at, source: 'CoinGecko' };
    },
    getHistory: (assetId, period) => history(assetId, period),
  };

  return { markets, history, prices, feed };
};

export type CoinGecko = ReturnType<typeof createCoinGecko>;
