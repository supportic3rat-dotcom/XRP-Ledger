import { asset as assetSpec, formatAmount, formatUnits, formatUsd, percentOf, simpleInterest, unitsToCents } from '@xrp/ledger';
import type { YieldPosition } from '@xrp/types';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { AreaChart } from '@/components/Charts';
import { KV } from '@/components/KV';
import { T } from '@/components/T';
import { useTheme } from '@/theme';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const HORIZONS = [
  { d: 10, l: 'In 10 days' },
  { d: 30, l: 'In 30 days' },
  { d: 90, l: 'In 90 days' },
  { d: 365, l: 'In 1 year' },
];

/** Accrued drops since `asOf`, at the position's rate (simple interest, rounded down to whole drops). */
export const accruedSince = (pos: YieldPosition, asOf: number, now: number): bigint => {
  const elapsed = BigInt(Math.max(0, Math.floor(now - asOf)));
  return pos.estimatedAccruedDrops + (pos.allocatedDrops * BigInt(pos.aprBps) * elapsed) / (10_000n * BigInt(YEAR_MS));
};

/** Ticks once a second. Text-only change, so it's fine with reduced motion. */
const useNow = () => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
};

/**
 * Live estimate of rewards accruing on a yield position, the net projection over set horizons,
 * and a one-year growth chart. `asOf` is when the position was fetched (the server's estimate is as of then).
 */
export const LiveAccrual = ({ pos, asOf, priceMicro }: { pos: YieldPosition; asOf: number; priceMicro?: bigint }) => {
  const { c } = useTheme();
  const a = pos.asset;
  const d = assetSpec(a).decimals;
  // Enough decimals that the counter visibly moves every second.
  const tick = { minDecimals: d, maxDecimals: d };
  const amt = (units: bigint, maxDecimals = 4) => formatAmount(units, a, { minDecimals: 2, maxDecimals: Math.min(maxDecimals, d) });
  const now = useNow();
  const accrued = accruedSince(pos, asOf, now);
  const perDay = simpleInterest(pos.allocatedDrops, pos.aprBps, 1);
  const net = (days: number) => {
    const gross = simpleInterest(pos.allocatedDrops, pos.aprBps, days);
    return gross - percentOf(gross, pos.feeBps);
  };
  const curve = useMemo(() => Array.from({ length: 13 }, (_, m) => Number(simpleInterest(pos.allocatedDrops, pos.aprBps, Math.round((m * 365) / 12)))), [pos]);

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 12 }}>
      <View style={{ padding: 14, borderRadius: 12, backgroundColor: c.accentSoft, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.pos }} />
          <T size={12.5} weight={500} color="accentText">
            Accruing now · estimate
          </T>
        </View>
        <T size={24} weight={600} ls={-0.02} num accessibilityLiveRegion="none" accessibilityLabel={`About ${amt(accrued)} accrued`}>
          {`${formatUnits(accrued, a, tick)} ${a}`}
        </T>
        <T size={12} color="text2" num>
          {`≈ ${amt(perDay, 8)} a day at ${(pos.aprBps / 100).toFixed(2)}% APR${priceMicro ? ` · ≈ ${formatUsd(unitsToCents(accrued, priceMicro, a))} so far` : ''}`}
        </T>
      </View>

      <View style={{ gap: 6 }}>
        <T size={13} weight={500} color="text2">
          Projected growth · next 12 months
        </T>
        <AreaChart values={curve} height={72} ariaLabel={`Projected rewards rising to about ${amt(net(365))} after one year`} />
      </View>

      <KV
        num
        padX={0}
        padY={0}
        rowPad={8}
        items={HORIZONS.map((h) => ({
          k: h.l,
          sub: priceMicro ? `≈ ${formatUsd(unitsToCents(net(h.d), priceMicro, a))} · net of fee` : 'Net of platform fee',
          v: `≈ ${amt(net(h.d), 8)}`,
        }))}
      />
      <T size={11.5} lh={1.5} color="text3">
        Estimates at today’s variable rate. Rewards are paid to your available balance daily.
      </T>
    </View>
  );
};
