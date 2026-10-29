import { formatXrp, formatXrpUnit } from '@xrp/ledger';
import type { Tone } from '@xrp/types';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useBalances, useCustodyStatus } from '@/data/hooks';
import { hm, hmz } from '@/lib/dates';
import { useTheme } from '@/theme';

const PROVIDER = {
  operational: { label: 'Operational', tone: 'ok' as Tone, banner: '', dep: ['Open', 'ok'] as const, wd: ['Open', 'ok'] as const },
  degraded: {
    label: 'Degraded',
    tone: 'wait' as Tone,
    banner: 'The custody provider is running slowly. Withdrawals may take longer than usual; deposits are unaffected.',
    dep: ['Open', 'ok'] as const,
    wd: ['Delayed', 'wait'] as const,
  },
  outage: {
    label: 'Outage',
    tone: 'bad' as Tone,
    banner: 'The custody provider is unavailable. Withdrawals are paused and deposits will be credited once it recovers. Your balances are unchanged.',
    dep: ['Delayed', 'wait'] as const,
    wd: ['Paused', 'bad'] as const,
  },
};
const DOCS = ['Custody Agreement', 'Deposit and Withdrawal Policy', 'Digital Asset Risk Disclosure'];

/** `.grid` — asset · deposits · withdrawals table (1.3fr / 1fr / 1fr). */
const GridRow = ({ head, cells, first }: { head?: boolean; first?: boolean; cells: React.ReactNode[] }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 11,
        paddingBottom: head ? 4.9 : 11,
        paddingHorizontal: 14,
        borderTopWidth: first || head ? 0 : 1,
        borderTopColor: c.border,
      }}
    >
      {cells.map((cell, i) => (
        <View key={i} style={{ flex: i === 0 ? 1.3 : 1, minWidth: 0 }}>
          {cell}
        </View>
      ))}
    </View>
  );
};

export const CustodyScreen = () => {
  const router = useRouter();
  const { c } = useTheme();
  const status = useCustodyStatus();
  const balances = useBalances();
  const b = balances.data;
  const total = b ? b.available + b.reserved + b.pendingYield + b.yield + b.collateral : 0n;
  const prov = PROVIDER[status.data?.provider ?? 'operational'];

  return (
    <Screen>
      <ScrollBody>
        <TopBar title="Custody account" leadingLabel="Back to Home" />
        <Card clip={false} style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="shield" color="accentText" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T weight={600}>Held in platform wallets</T>
              <T size={12} mono color="text3">{`Sub-account ${status.data?.subAccount ?? ''}`}</T>
            </View>
          </View>
          <KV
            num
            padX={0}
            padY={0}
            items={[
              { k: 'Account', v: <Status tone="ok" label="Provisioned" size={12.5} base="text" /> },
              { k: 'Provider status', v: <Status tone={prov.tone} label={prov.label} size={12.5} base="text" /> },
              { k: 'Restrictions', v: 'None' },
            ]}
          />
        </Card>
        {prov.banner ? (
          <Banner tone={prov.tone === 'bad' ? 'error' : 'warn'} icon="alert" alert style={{ marginTop: 10 }}>
            {prov.banner}
          </Banner>
        ) : null}

        <Sec>Holdings in custody</Sec>
        <Card>
          <KV
            num
            items={[
              { k: 'Total', keyStrong: true, v: formatXrpUnit(total), valueSize: 15 },
              { k: 'Available', v: formatXrpUnit(b?.available ?? 0n) },
              { k: 'Restricted · yield allocation', v: formatXrpUnit((b?.yield ?? 0n) + (b?.pendingYield ?? 0n)) },
              { k: 'Restricted · loan collateral', v: formatXrpUnit(b?.collateral ?? 0n) },
              { k: 'Reserved · pending withdrawals', v: formatXrpUnit(b?.reserved ?? 0n) },
            ]}
          />
        </Card>
        <T size={12} color="text3" style={{ marginTop: 8, marginHorizontal: 4 }}>
          {`Reconciled with the provider’s records at ${status.data ? hmz(status.data.reconciledAt) : ''}. Pending deposits aren’t included until credited.`}
        </T>

        <Sec>Supported assets</Sec>
        <Card>
          <GridRow
            head
            cells={['Asset · network', 'Deposits', 'Withdrawals'].map((h) => (
              <T key={h} size={11.5} weight={500} color="text3">
                {h}
              </T>
            ))}
          />
          <GridRow
            first
            cells={[
              <T key="a" size={13} weight={500}>
                XRP · XRP Ledger
              </T>,
              <Status key="d" tone={prov.dep[1]} label={prov.dep[0]} size={12.5} base="text" />,
              <Status key="w" tone={prov.wd[1]} label={prov.wd[0]} size={12.5} base="text" />,
            ]}
          />
          {['BTC · Bitcoin', 'ETH · Ethereum'].map((name) => (
            <GridRow
              key={name}
              cells={[
                <T key="a" size={13} color="text2">
                  {name}
                </T>,
                <Status key="d" tone="off" label="Planned" size={12.5} />,
                <Status key="w" tone="off" label="Planned" size={12.5} />,
              ]}
            />
          ))}
        </Card>

        <Sec>Controls</Sec>
        <Card>
          <KV
            num
            items={[
              { k: 'Transaction signing', v: 'Inside provider (MPC)' },
              { k: 'Withdrawal approval', v: '2 reviewers over 1,000 XRP' },
              {
                k: 'Address allowlist',
                v: (
                  <Pressable accessibilityRole="link" onPress={() => router.push('/security')} hitSlop={10}>
                    <T size={13.5} weight={500} color="accentText" underline>
                      Manage
                    </T>
                  </Pressable>
                ),
              },
              { k: 'Daily withdrawal limit', v: `${formatXrp(25_000_000_000n, { minDecimals: 0, maxDecimals: 2 })} XRP` },
            ]}
          />
        </Card>

        <Sec>Fees</Sec>
        <Card>
          <KV
            num
            items={[
              { k: 'Custody fee', v: 'None' },
              { k: 'Withdrawal fee', v: '0.25 XRP' },
              { k: 'Deposit fee', v: 'None' },
            ]}
          />
        </Card>

        <Sec>Documents</Sec>
        <Card>
          {DOCS.map((d, i) => (
            <Row key={d} first={i === 0} minHeight={52} accessibilityRole="link" onPress={() => router.push('/legal')}>
              <T weight={500} style={{ flex: 1 }}>
                {d}
              </T>
              <Icon name="chevronRight" size="sm" color="text3" />
            </Row>
          ))}
        </Card>
        <Banner tone="info" icon="info" style={{ marginTop: 16 }}>
          No insurance, asset segregation or regulatory approval is claimed. Those details will appear here only once they’re documented.
        </Banner>
        {api.mode === 'demo' ? (
          <T size={11.5} color="text3" align="center" style={{ marginTop: 16 }}>
            Sample data · fees and limits are placeholders
          </T>
        ) : null}
      </ScrollBody>
    </Screen>
  );
};
