import { type MouseEvent, useEffect, useMemo, useState } from 'react';

/** A chart point: value in dollars (display only; balances themselves are integer units), axis label and tooltip. */
export type ChartPoint = { v: number; axis: string; tip: string };

const nice = (x: number) => {
  const e = 10 ** Math.floor(Math.log10(x));
  const f = x / e;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
};
const money = (v: number, d: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const full = (v: number) => (v < 10 ? money(v, 4) : money(v, 2));

/** Scales, ticks, end marker and hover state for the performance chart (PerformanceChart.dc.html). */
export const useChart = (points: ChartPoint[], height: number, accent: string) => {
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => setHi(null), [points]);

  const base = useMemo(() => {
    const pts =
      points.length > 1
        ? points
        : [
            { v: 0, axis: '', tip: '' },
            { v: 0, axis: '', tip: '' },
          ];
    const n = pts.length;
    const vals = pts.map((p) => p.v);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const range = mx - mn || Math.abs(mx) * 0.02 || 1;
    const lo = mn - range * 0.12;
    const top = mx + range * 0.28;
    const X = (i: number) => (i / (n - 1)) * 1000;
    const Y = (v: number) => 100 - ((v - lo) / (top - lo)) * 100;
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(2)}`).join(' ');
    const step = nice((top - lo) / 4);
    const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
    const last = vals[n - 1] ?? 0;
    const endTop = Y(last);
    const ticks: { top: string; label: string; opacity: number }[] = [];
    for (let t = Math.ceil(lo / step) * step; t <= top; t += step) {
      const y = Y(t);
      if (y < 4 || y > 98) continue;
      ticks.push({ top: y.toFixed(2), label: money(t, dec), opacity: Math.abs(y - endTop) < 9 ? 0 : 1 });
    }
    const xlabels = [0, 0.25, 0.5, 0.75, 1].map((f, k) => {
      const idx = Math.round(f * (n - 1));
      return { left: ((idx / (n - 1)) * 100).toFixed(2), text: pts[idx]?.axis ?? '', tx: k === 0 ? '0' : k === 4 ? '-100%' : '-50%' };
    });
    const first = vals[0] ?? 0;
    const delta = last - first;
    return {
      n,
      pts,
      vals,
      Y,
      line,
      area: `${line} L1000 100 L0 100 Z`,
      ticks,
      end: { top: endTop.toFixed(2), label: last >= 1000 ? money(last, 0) : full(last) },
      xlabels,
      aria: `Line chart from ${pts[0]?.tip} to ${pts[n - 1]?.tip}: ${full(first)} to ${full(last)}, ${delta >= 0 ? 'up ' : 'down '}${full(Math.abs(delta))}.`,
    };
  }, [points]);

  const hover =
    hi !== null && hi < base.n
      ? (() => {
          const left = (hi / (base.n - 1)) * 100;
          return {
            on: true,
            left: left.toFixed(2),
            top: base.Y(base.vals[hi] ?? 0).toFixed(2),
            value: full(base.vals[hi] ?? 0),
            tip: base.pts[hi]?.tip ?? '',
            tx: left > 70 ? 'calc(-100% - 16px)' : '0',
          };
        })()
      : { on: false, left: '0', top: '0', value: '', tip: '', tx: '0' };

  return {
    h: height,
    accent,
    line: base.line,
    area: base.area,
    ticks: base.ticks,
    end: base.end,
    xlabels: base.xlabels,
    aria: base.aria,
    hover,
    onMove: (e: MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const rel = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const idx = Math.round(rel * (base.n - 1));
      if (idx !== hi) setHi(idx);
    },
    onLeave: () => setHi(null),
  };
};

export type ChartVals = ReturnType<typeof useChart>;
