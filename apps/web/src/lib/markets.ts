import { ASSETS, asset as assetSpec, assetLimits, displayDecimals, networkFeeEstimate } from '@xrp/ledger';
import { createCoinGecko, MOCK_PRICES, type MarketStats } from '@xrp/providers';
import { coinColors } from '@xrp/tokens';
import type { Asset, PeriodId, SeriesPoint } from './data/types';
import { PERIOD_IDS } from './data/types';
import { centsOf } from './money';
import { labelsFor } from './series';

/**
 * Live market data for the dashboard (CoinGecko, cached a minute in the tab). Display only: the server prices
 * money actions. When the API can't be reached, sample prices stand in and `live` is false.
 */
const cg = createCoinGecko({ apiKey: process.env.NEXT_PUBLIC_COINGECKO_API_KEY });
let cache: { at: number; rows: MarketStats[] } | null = null;

export const fetchMarkets = async (): Promise<{ rows: MarketStats[]; live: boolean }> => {
  if (cache && Date.now() - cache.at < 60_000) return { rows: cache.rows, live: true };
  try {
    const rows = await cg.markets();
    if (rows.length) {
      cache = { at: Date.now(), rows };
      return { rows, live: true };
    }
  } catch {
    /* sample prices below */
  }
  return {
    live: false,
    rows: ASSETS.map((a) => ({
      asset: a.id,
      priceMicro: MOCK_PRICES[a.id] ?? 1_000_000n,
      changeBps: 0,
      change7dBps: null,
      marketCapUsd: 0,
      volume24hUsd: 0,
      high24hMicro: 0n,
      low24hMicro: 0n,
      athMicro: 0n,
      athDate: null,
      circulatingSupply: null,
      maxSupply: null,
      rank: null,
      sparkline: [],
      updatedAt: new Date().toISOString(),
    })),
  };
};

const PLACEHOLDER: Record<string, string> = { XRP: 'r…', BTC: 'bc1…', ETH: '0x…', USDT: 'T…', USDC: '0x…', SOL: '', BNB: '0x…', TRX: 'T…', XLM: 'G…', TON: 'UQ…' };

/**
 * A dashboard asset from the registry, a market row and the customer's balance. Period changes start from the
 * market data (24h, 7d) and are replaced by the chart series once it loads.
 */
export const toAsset = (id: string, row: MarketStats | undefined, units: bigint, feesDeducted: boolean): Asset => {
  const a = assetSpec(id);
  const lim = assetLimits(id);
  const d24 = row?.changeBps ?? 0;
  const d7 = row?.change7dBps ?? 0;
  return {
    id,
    name: a.name,
    ticker: id,
    network: a.network,
    glyph: id.slice(0, 1),
    color: coinColors[id] ?? '#17211D',
    units,
    scale: a.decimals,
    decimals: Math.min(displayDecimals(id), a.decimals),
    priceMicro: row?.priceMicro ?? MOCK_PRICES[id] ?? 0n,
    changeBps: d24,
    periodChangeBps: { '1D': d24, '1W': d7, '1M': 0, '3M': 0, '1Y': 0, ALL: 0 },
    // Live: the platform fee (plus XRP's network fee) comes out of the amount.
    feeUnits: feesDeducted ? lim.withdrawalFee + networkFeeEstimate(id) : lim.withdrawalFee,
    usesTag: a.memo !== null,
    memoKind: a.memo,
    placeholder: PLACEHOLDER[id] ?? '',
    held: true,
  };
};

/** Price history as chart points; `units` set (scale = asset decimals) turns it into a holding value. */
export const historySeries = async (
  holdings: { id: string; units: bigint; scale: number }[] | string,
  period: PeriodId,
): Promise<SeriesPoint[]> => {
  const end = new Date();
  if (typeof holdings === 'string') {
    const pts = await cg.history(holdings, period, 60);
    return pts.map((p) => ({ v: Number(p.priceMicro) / 1e6, ...labelsFor(period, new Date(p.at), end) }));
  }
  const held = holdings.filter((h) => h.units > 0n);
  if (!held.length) return [];
  // The three largest holdings get real history (the free API tier is rate limited); the rest count at today's price.
  const priced = (await fetchMarkets()).rows;
  const now = (id: string) => Number(priced.find((r) => r.asset === id)?.priceMicro ?? 0n) / 1e6;
  const amount = (h: (typeof held)[number]) => Number(h.units) / 10 ** h.scale;
  const ranked = [...held].sort((x, y) => amount(y) * now(y.id) - amount(x) * now(x.id));
  const charted = ranked.slice(0, 3);
  const flat = ranked.slice(3).reduce((sum, h) => sum + amount(h) * now(h.id), 0);
  const all = await Promise.all(charted.map((h) => cg.history(h.id, period, 60)));
  const n = Math.min(...all.map((s) => s.length));
  const ref = all.reduce((best, s) => (s.length >= best.length ? s : best), all[0] ?? []);
  return Array.from({ length: n }, (_, i) => {
    const v = charted.reduce((sum, h, k) => {
      const s = all[k] ?? [];
      const p = s[Math.round((i * (s.length - 1)) / Math.max(1, n - 1))];
      return sum + amount(h) * (p ? Number(p.priceMicro) / 1e6 : 0);
    }, flat);
    const at = ref[Math.round((i * (ref.length - 1)) / Math.max(1, n - 1))]?.at;
    return { v: Math.round(v * 100) / 100, ...labelsFor(period, at ? new Date(at) : end, end) };
  });
};

/** Builds every supported asset from live market data; held ones carry the demo balances. */
export const assetsFrom = async (holdings: Record<string, bigint>, feesDeducted: boolean): Promise<{ assets: Asset[]; live: boolean }> => {
  const { rows, live } = await fetchMarkets();
  // Every supported asset can be opened, received and traded; balances are zero until deposited.
  const assets = ASSETS.map((a) => toAsset(a.id, rows.find((r) => r.asset === a.id), holdings[a.id] ?? 0n, feesDeducted));
  return { assets, live };
};

/** Portfolio value now and its change over the periods we know from market data (24h, 7d); the chart fills in the rest. */
export const portfolioOf = (assets: Asset[]): { cents: bigint; change: Record<PeriodId, bigint> } => {
  const cents = assets.reduce((s, a) => s + centsOf(a.units, a.scale, a.priceMicro), 0n);
  const changeFor = (period: PeriodId) =>
    assets.reduce((s, a) => {
      const v = centsOf(a.units, a.scale, a.priceMicro);
      const bps = BigInt(a.periodChangeBps[period]);
      return s + (v * bps) / (10_000n + bps);
    }, 0n);
  return { cents, change: Object.fromEntries(PERIOD_IDS.map((p) => [p, changeFor(p)])) as Record<PeriodId, bigint> };
};

