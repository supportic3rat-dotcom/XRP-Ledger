import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Card } from '@/components/Card';
import { Row } from '@/components/Row';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { xrp0, xrp2 } from '../data/format';
import { useOps } from '../hooks';
import { opsRoute } from '../routes';
import { Line, Loading, OpsScreen, Panel, SecT } from '../ui';

export const OverviewScreen = () => {
  const router = useRouter();
  const q = useOps('overview', (d) => d.overview());
  const o = q.data;
  const pct = !o || o.outflowLimitDrops === 0n ? 0 : Number((o.outflowTodayDrops * 1000n) / o.outflowLimitDrops) / 10;
  const metrics = o
    ? [
        { label: 'Pending approvals', value: String(o.pending), note: o.oldest, tone: o.pending ? 'wait' : 'ok', href: '/queue' },
        { label: 'Customer liabilities', value: `${xrp2(o.liabilitiesDrops)} XRP`, note: `${o.coveragePct} covered by holdings`, tone: 'ok', href: '/reconciliation' },
        {
          label: 'Reconciliation exceptions',
          value: String(o.exceptionsOpen),
          note: o.exceptionsOpen ? `Last run ${o.lastRun}` : 'All clear',
          tone: o.exceptionsOpen ? 'wait' : 'ok',
          href: '/reconciliation',
        },
        { label: 'Outflow today', value: `${xrp0(o.outflowTodayDrops)} XRP`, note: `${pct.toFixed(1)}% of ${xrp0(o.outflowLimitDrops)} daily limit`, tone: 'ok', href: '/custody' },
      ]
    : [];

  return (
    <OpsScreen tab title="Overview" sub="Platform health at a glance. Tap any card to drill in." refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {!o ? (
        <Loading error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {metrics.map((m) => (
              <Card key={m.label} style={{ flexBasis: '47%', flexGrow: 1 }}>
                <Row first minHeight={0} padding={{ v: 14, h: 14 }} onPress={() => router.push(opsRoute(m.href))} accessibilityLabel={`${m.label}: ${m.value}. ${m.note}`}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <T size={12.5} color="text3">
                      {m.label}
                    </T>
                    <T size={19} weight={600} num ls={-0.01}>
                      {m.value}
                    </T>
                    <T size={12} lh={1.35} weight={500} color={m.tone === 'wait' ? 'warn' : 'pos'}>
                      {m.note}
                    </T>
                  </View>
                </Row>
              </Card>
            ))}
          </View>

          <Panel style={{ gap: 0 }}>
            <SecT>Provider health</SecT>
            {o.providers.map((p, i) => (
              <Line key={p.name} first={i === 0}>
                <View style={{ flex: 1, gap: 1 }}>
                  <T size={13.5} weight={500}>
                    {p.name}
                  </T>
                  <T size={12} color="text3">
                    {p.note}
                  </T>
                </View>
                <Status tone={p.tone} label={p.status} />
              </Line>
            ))}
          </Panel>

          <View>
            <T size={13} weight={600} color="text2" accessibilityRole="header" style={{ marginHorizontal: 4, marginBottom: 8 }}>
              Needs attention
            </T>
            <Card>
              {o.attention.length === 0 ? (
                <T size={13} color="text3" style={{ padding: 14 }}>
                  Nothing needs attention.
                </T>
              ) : null}
              {o.attention.map((a, i) => (
                <Row key={a.title} first={i === 0} chevron onPress={() => router.push(opsRoute(a.href))} accessibilityLabel={`${a.title}. ${a.note}. Open ${a.where}`}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Status tone={a.tone} label={a.title} size={13.5} base="text" />
                    <T size={12} color="text3">
                      {`${a.note} · ${a.where}`}
                    </T>
                  </View>
                </Row>
              ))}
            </Card>
          </View>
        </>
      )}
    </OpsScreen>
  );
};
