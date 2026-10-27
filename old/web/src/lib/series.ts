import { hm, md, monthYear, sameDay, weekday, year } from './dates';
import type { PeriodId, SeriesPoint } from './data/types';

/** Chart sampling per period: points, minutes between points, axis format (from the design). */
export const PERIODS: Record<
  PeriodId,
  { n: number; step?: number; months?: boolean; suffix: string; vol: number; fmt: 'time' | 'weekday' | 'date' | 'month' }
> = {
  '1D': { n: 49, step: 30, suffix: 'today', vol: 0.004, fmt: 'time' },
  '1W': { n: 43, step: 240, suffix: 'past week', vol: 0.01, fmt: 'weekday' },
  '1M': { n: 31, step: 1440, suffix: 'past month', vol: 0.02, fmt: 'date' },
  '3M': { n: 46, step: 2880, suffix: 'past 3 months', vol: 0.03, fmt: 'date' },
  '1Y': { n: 53, step: 10080, suffix: 'past year', vol: 0.05, fmt: 'date' },
  ALL: { n: 61, months: true, suffix: 'since Oct 2021', vol: 0.07, fmt: 'month' },
};

const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A random walk pinned to zero at both ends, scaled to ±1. */
const bridge = (n: number, seed: number) => {
  const r = rng(seed);
  const w = [0];
  for (let i = 1; i < n; i++) w.push((w[i - 1] ?? 0) + (r() - 0.5));
  const last = w[n - 1] ?? 0;
  const b = w.map((x, i) => x - (last * i) / (n - 1));
  const m = Math.max(...b.map(Math.abs));
  return b.map((x) => (m ? x / m : 0));
};

/** Point times for a period ending at `end`. */
export const pointDates = (period: PeriodId, end: Date): Date[] => {
  const p = PERIODS[period];
  return Array.from({ length: p.n }, (_, i) => {
    if (p.months) {
      const d = new Date(end);
      d.setDate(1);
      d.setMonth(d.getMonth() - (p.n - 1 - i));
      return d;
    }
    return new Date(end.getTime() - (p.n - 1 - i) * (p.step ?? 0) * 60_000);
  });
};

export const labelsFor = (period: PeriodId, d: Date, end: Date): { axis: string; tip: string } => {
  const fmt = PERIODS[period].fmt;
  if (fmt === 'time') return { axis: hm(d), tip: `${sameDay(d, end) ? 'Today' : 'Yesterday'}, ${hm(d)}` };
  if (fmt === 'weekday') return { axis: weekday(d), tip: `${weekday(d)} ${md(d)}, ${hm(d)}` };
  if (fmt === 'date') return { axis: md(d), tip: `${md(d)}, ${year(d)}` };
  return { axis: monthYear(d), tip: monthYear(d) };
};

/** Illustrative series between start and end (demo mode and as a fallback when history is unavailable). */
export const syntheticSeries = (period: PeriodId, end: Date, endValue: number, change: number, vol: number, seed: number): SeriesPoint[] => {
  const p = PERIODS[period];
  const start = endValue - change;
  const b = bridge(p.n, seed);
  return pointDates(period, end).map((d, i) => {
    const trend = start + (change * i) / (p.n - 1);
    const v = i === 0 ? start : i === p.n - 1 ? endValue : trend * (1 + vol * (b[i] ?? 0));
    return { v: Math.round(v * 10000) / 10000, ...labelsFor(period, d, end) };
  });
};
