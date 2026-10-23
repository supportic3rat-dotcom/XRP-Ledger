/** Seeded PRNG + Brownian bridge from the design source, so sample charts render identically. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type ChartPeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type PeriodSpec = { id: ChartPeriod; pct: number; suffix: string; n: number };

export const chartPeriods: readonly PeriodSpec[] = [
  { id: '1D', pct: 3.1, suffix: 'today', n: 48 },
  { id: '1W', pct: 6.4, suffix: 'past week', n: 42 },
  { id: '1M', pct: 12.8, suffix: 'past month', n: 30 },
  { id: '3M', pct: -4.6, suffix: 'past 3 months', n: 45 },
  { id: '6M', pct: 23.8, suffix: 'past 6 months', n: 52 },
  { id: '1Y', pct: 58.2, suffix: 'past year', n: 52 },
  { id: 'ALL', pct: 240, suffix: 'since Oct 2021', n: 60 },
];

/**
 * Sample series ending at `end`. Display-only (chart geometry), never used for money.
 * Home uses seed n*13+7 and amplitude 0.035; XRP detail uses n*31+3 and 0.05.
 */
export const sampleSeries = (period: PeriodSpec, end: number, seed: number, amplitude: number): number[] => {
  const r = mulberry32(seed);
  const n = period.n;
  const w = [0];
  for (let i = 1; i < n; i++) w.push((w[i - 1] ?? 0) + (r() - 0.5));
  const last = w[n - 1] ?? 0;
  let m = 0;
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = (w[i] ?? 0) - (last * i) / (n - 1);
    b.push(v);
    m = Math.max(m, Math.abs(v));
  }
  const start = end / (1 + period.pct / 100);
  return b.map((v, i) => (i === n - 1 ? end : (start + ((end - start) * i) / (n - 1)) * (1 + amplitude * (m ? v / m : 0))));
};

/** Markets sparkline path in a 100×30 viewBox. */
export const sparkPath = (seed: number, change: number): string => {
  const r = mulberry32(seed);
  const n = 24;
  const w = [0];
  for (let i = 1; i < n; i++) w.push((w[i - 1] ?? 0) + (r() - 0.5));
  const last = w[n - 1] ?? 0;
  const b = w.map((v, i) => v - (last * i) / (n - 1) + ((change >= 0 ? 1 : -1) * 2.2 * i) / (n - 1));
  const mn = Math.min(...b);
  const mx = Math.max(...b);
  const rg = mx - mn || 1;
  return b.map((x, k) => `${k ? 'L' : 'M'}${((k / (n - 1)) * 100).toFixed(1)} ${(28 - ((x - mn) / rg) * 26).toFixed(1)}`).join(' ');
};

/** Line/area paths in a 1000×100 viewBox with the design's 10%/15% padding. */
export const chartPaths = (values: readonly number[]): { line: string; area: string; endTop: number } => {
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const rg = mx - mn || 1;
  const lo = mn - rg * 0.1;
  const hi = mx + rg * 0.15;
  const n = values.length;
  const y = (x: number) => 100 - ((x - lo) / (hi - lo)) * 100;
  const line = values.map((x, i) => `${i ? 'L' : 'M'}${((i / (n - 1)) * 1000).toFixed(1)} ${y(x).toFixed(2)}`).join(' ');
  return { line, area: `${line} L1000 100 L0 100 Z`, endTop: y(values[n - 1] ?? 0) };
};

/** Sparkline path in a 100×30 viewBox from real values (e.g. CoinGecko's 7-day hourly prices). */
export const sparkPathFrom = (values: readonly number[]): string => {
  if (values.length < 2) return 'M0 15 L100 15';
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const rg = mx - mn || 1;
  const n = values.length;
  return values.map((x, k) => `${k ? 'L' : 'M'}${((k / (n - 1)) * 100).toFixed(1)} ${(28 - ((x - mn) / rg) * 26).toFixed(1)}`).join(' ');
};
