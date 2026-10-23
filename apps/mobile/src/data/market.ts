import { ASSETS, asset as assetSpec } from '@xrp/ledger';
import { MOCK_PRICES, chartPeriods, createCoinGecko, sampleSeries, type ChartPeriod, type MarketStats } from '@xrp/providers';
import type { MicroUsd } from '@xrp/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Live market data (prices, 24h change, 7-day sparklines, market stats and chart history) from CoinGecko.
 * Display only: money actions are priced on the server from the `prices` table the worker records.
 * If CoinGecko can't be reached, the screens fall back to sample data and say so (`live: false`).
 */
const cg = createCoinGecko({ apiKey: process.env.EXPO_PUBLIC_COINGECKO_API_KEY });

export type MarketAsset = MarketStats & { name: string; network: string; live: boolean };

const sample = (): MarketAsset[] =>
  ASSETS.map((a) => {
    const price = MOCK_PRICES[a.id] ?? 1_000_000n;
    const spec = chartPeriods[1]!;
    return {
      asset: a.id,
      name: a.name,
      network: a.network,
      live: false,
      priceMicro: price,
      changeBps: 0,
      change7dBps: null,
      marketCapUsd: 0,
      volume24hUsd: 0,
      high24hMicro: price,
      low24hMicro: price,
      athMicro: 0n,
      athDate: null,
      circulatingSupply: null,
      maxSupply: null,
      rank: null,
      sparkline: sampleSeries(spec, Number(price) / 1e6, a.seed * 7 + 1, 0.04),
      updatedAt: new Date().toISOString(),
    };
  });

/** Last prices seen, for code outside React (the demo backend prices its simulated quotes with them). */
const latest: Record<string, MicroUsd> = {};
export const latestPrice = (asset: string): MicroUsd => latest[asset] ?? MOCK_PRICES[asset] ?? 1_000_000n;

const fetchMarkets = async (): Promise<MarketAsset[]> => {
  try {
    const live = await cg.markets();
    if (!live.length) return sample();
    for (const m of live) latest[m.asset] = m.priceMicro;
    return live.map((m) => ({ ...m, name: assetSpec(m.asset).name, network: assetSpec(m.asset).network, live: true }));
  } catch {
    return sample();
  }
};

/** All supported assets with live prices; refreshed every minute. */
export const useMarkets = () =>
  useQuery({ queryKey: ['markets', 'live'], queryFn: fetchMarkets, refetchInterval: 60_000, staleTime: 30_000, placeholderData: (prev) => prev });

/** Latest price per asset (micro-USD), from live markets with the sample prices as a floor until they load. */
export const usePriceMap = (): { prices: Record<string, MicroUsd>; live: boolean; at: string | null; loading: boolean } => {
  const m = useMarkets();
  return useMemo(() => {
    const prices: Record<string, MicroUsd> = { ...MOCK_PRICES };
    for (const row of m.data ?? []) prices[row.asset] = row.priceMicro;
    const live = (m.data ?? []).some((r) => r.live);
    return { prices, live, at: m.data?.[0]?.updatedAt ?? null, loading: m.isLoading };
  }, [m.data, m.isLoading]);
};

export const useMarket = (asset: string): MarketAsset | undefined => {
  const m = useMarkets();
  return m.data?.find((r) => r.asset === asset);
};

export type Series = { values: number[]; times: string[]; pct: number; live: boolean };

const seriesFrom = (values: number[], times: string[], live: boolean): Series => {
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  return { values, times, pct: first ? ((last - first) / first) * 100 : 0, live };
};

const fetchHistory = async (asset: string, period: ChartPeriod): Promise<Series> => {
  try {
    const pts = await cg.history(asset, period, 90);
    if (pts.length > 1) return seriesFrom(pts.map((p) => Number(p.priceMicro) / 1e6), pts.map((p) => p.at), true);
  } catch {
    /* fall through to the sample curve */
  }
  const spec = chartPeriods.find((p) => p.id === period) ?? chartPeriods[2]!;
  const values = sampleSeries(spec, Number(MOCK_PRICES[asset] ?? 1_000_000n) / 1e6, spec.n * 31 + assetSpec(asset).seed, 0.05);
  return seriesFrom(values, values.map(() => ''), false);
};

/** Price history for one asset and chart period (cached 5 minutes; CoinGecko's free tier is rate limited). */
export const usePriceHistory = (asset: string, period: ChartPeriod, enabled = true) =>
  useQuery({ queryKey: ['history', asset, period], queryFn: () => fetchHistory(asset, period), staleTime: 5 * 60_000, enabled });

/** How many holdings get their own price history in the portfolio chart (CoinGecko's free tier is rate limited). */
const CHARTED = 3;

/**
 * Value of the current holdings over a period, from the largest holdings' real price history (smaller ones are
 * counted at today's price). Reflects price moves only — not deposits or withdrawals, which the caption says.
 * Histories share the cache with the asset pages.
 */
export const usePortfolioHistory = (holdings: { asset: string; units: bigint; value?: bigint }[], period: ChartPeriod) => {
  const qc = useQueryClient();
  const held = holdings.filter((h) => h.units > 0n);
  const key = held.map((h) => `${h.asset}:${h.units}`).join(',');
  return useQuery({
    queryKey: ['portfolio-history', period, key],
    enabled: held.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Series> => {
      const charted = held.slice(0, CHARTED);
      const rest = held.slice(CHARTED);
      const all = await Promise.all(
        charted.map((h) => qc.fetchQuery({ queryKey: ['history', h.asset, period], queryFn: () => fetchHistory(h.asset, period), staleTime: 5 * 60_000 })),
      );
      const flat = rest.reduce((sum, h) => sum + (Number(h.units) / 10 ** assetSpec(h.asset).decimals) * (Number(latestPrice(h.asset)) / 1e6), 0);
      const n = Math.min(...all.map((s) => s.values.length));
      const values = Array.from({ length: n }, (_, i) =>
        charted.reduce((sum, h, k) => {
          const s = all[k]!;
          const v = s.values[Math.round((i * (s.values.length - 1)) / Math.max(1, n - 1))] ?? 0;
          return sum + (Number(h.units) / 10 ** assetSpec(h.asset).decimals) * v;
        }, flat),
      );
      const times = all.reduce((best, s) => (s.times.length >= best.length ? s.times : best), [] as string[]);
      return seriesFrom(values, times.length === n ? times : values.map(() => ''), all.every((s) => s.live));
    },
  });
};

/** Compact USD for market stats: $1.62T, $48.3B, $912.4M. */
export const compactUsd = (v: number): string => {
  if (!v) return '—';
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [n, s] of units) if (v >= n) return `$${(v / n).toFixed(v / n >= 100 ? 0 : 1)}${s}`;
  return `$${v.toFixed(0)}`;
};

export const compactNumber = (v: number | null): string => {
  if (!v) return '—';
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [n, s] of units) if (v >= n) return `${(v / n).toFixed(v / n >= 100 ? 0 : 2)}${s}`;
  return v.toFixed(0);
};
