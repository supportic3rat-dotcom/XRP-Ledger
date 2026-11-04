import { ASSETS, asset as assetSpec } from '@xrp/ledger';
import { MOCK_PRICES, chartPeriods, createCoinGecko, sampleSeries, type ChartPeriod, type MarketStats } from '@xrp/providers';
import type { MicroUsd } from '@xrp/types';
import { useQueries, useQuery } from '@tanstack/react-query';
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

/** A settled change to a balance: + in, − out, in the asset's base units. */
export type BalanceFlow = { asset: string; units: bigint; at: string };

const DAY = 86_400_000;
const PERIOD_MS: Record<ChartPeriod, number> = { '1D': DAY, '1W': 7 * DAY, '1M': 30 * DAY, '3M': 90 * DAY, '6M': 180 * DAY, '1Y': 365 * DAY, ALL: 5 * 365 * DAY };

/** Point times for a series: its own when it has them, otherwise evenly spaced across the period, ending now. */
const timesOf = (s: Series, period: ChartPeriod, now: number): number[] => {
  const own = s.times.map((t) => Date.parse(t));
  if (own.length === s.values.length && own.every((t) => Number.isFinite(t))) return own;
  const n = s.values.length;
  return s.values.map((_, i) => now - PERIOD_MS[period] + (i * PERIOD_MS[period]) / Math.max(1, n - 1));
};

const toCoins = (units: bigint, asset: string) => Number(units) / 10 ** assetSpec(asset).decimals;

/**
 * What the customer's balance was worth across a period: at each point, the coins they held then (today's holdings
 * with later deposits, withdrawals and swaps taken back out) at that point's price. The last point is today's balance
 * at the latest price, so the chart grows with every deposit and moves with every price refresh. The largest holdings
 * use their real price history; smaller ones are counted at today's price. Histories share the cache with the asset pages.
 */
export const usePortfolioHistory = (
  holdings: { asset: string; units: bigint; value?: bigint }[],
  period: ChartPeriod,
  flows: BalanceFlow[] = [],
  now: () => Date = () => new Date(),
) => {
  const { prices } = usePriceMap();
  const assets = [...new Set([...holdings.filter((h) => h.units > 0n).map((h) => h.asset), ...flows.map((f) => f.asset)])];
  const charted = assets.slice(0, CHARTED);
  const histories = useQueries({
    queries: charted.map((asset) => ({ queryKey: ['history', asset, period], queryFn: () => fetchHistory(asset, period), staleTime: 5 * 60_000 })),
  });
  const loaded = histories.every((h) => h.data);
  const stamp = histories.map((h) => h.dataUpdatedAt).join(',');
  const heldKey = holdings.map((h) => `${h.asset}:${h.units}`).join(',');
  const flowsKey = flows.map((f) => `${f.asset}:${f.units}@${f.at}`).join(',');

  const data = useMemo((): Series | undefined => {
    if (!loaded) return undefined;
    const end = now().getTime();
    const base = histories[0]?.data ?? { values: Array<number>(chartPeriods.find((p) => p.id === period)?.n ?? 30).fill(0), times: [], pct: 0, live: true };
    const times = timesOf(base, period, end);
    const held = new Map(holdings.map((h) => [h.asset, h.units]));
    const priceAt = (asset: string, i: number): number => {
      const k = charted.indexOf(asset);
      const s = histories[k]?.data;
      if (!s) return Number(prices[asset] ?? latestPrice(asset)) / 1e6;
      return s.values[Math.round((i * (s.values.length - 1)) / Math.max(1, times.length - 1))] ?? 0;
    };
    const unitsAt = (asset: string, t: number) =>
      flows.reduce((u, f) => (f.asset === asset && Date.parse(f.at) > t ? u - f.units : u), held.get(asset) ?? 0n);
    const values = times.map((t, i) => assets.reduce((sum, a) => {
      const u = unitsAt(a, t);
      return u > 0n ? sum + toCoins(u, a) * priceAt(a, i) : sum;
    }, 0));
    const today = assets.reduce((sum, a) => sum + toCoins(held.get(a) ?? 0n, a) * (Number(prices[a] ?? latestPrice(a)) / 1e6), 0);
    values.push(today);
    const iso = [...times, end].map((t) => new Date(t).toISOString());
    return seriesFrom(values, iso, histories.every((h) => h.data?.live));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, stamp, period, prices, heldKey, flowsKey]);

  return { data, isLoading: !loaded };
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
