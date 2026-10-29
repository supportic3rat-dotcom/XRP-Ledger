import { asset as assetSpec, assetLimits, formatAmount, isAssetId, unitsToCents } from '@xrp/ledger';
import { chartPeriods, type ChartPeriod } from '@xrp/providers';
import type { IconName } from '@xrp/tokens';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Card } from '@/components/Card';
import { AreaChart } from '@/components/Charts';
import { PeriodChips } from '@/components/Chips';
import { CoinLogo } from '@/components/CoinLogo';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { TxDetailSheet } from '@/components/TxDetailSheet';
import { TxRow } from '@/components/TxRow';
import type { TxView } from '@/data/describeTx';
import { useActivity, useBalances, useMarket, usePriceHistory, useProfile } from '@/data/hooks';
import { compactNumber } from '@/data/market';
import { PERIOD_IDS } from '@/data/series';
import { hm, hmz, md } from '@/lib/dates';
import { useMoney } from '@/lib/money';
import { useTheme } from '@/theme';

type Act = { label: string; icon: IconName; path: '/deposit' | '/withdraw' | '/exchange' | '/earn' };

/** One asset: live price and chart, market statistics, the customer's balances in it, its activity and how it works here. */
export const AssetDetailScreen = () => {
  const router = useRouter();
  const { c } = useTheme();
  const m = useMoney();
  const params = useLocalSearchParams<{ symbol?: string }>();
  const id = params.symbol && isAssetId(params.symbol.toUpperCase()) ? params.symbol.toUpperCase() : 'XRP';
  const spec = assetSpec(id);
  const lim = assetLimits(id);
  const market = useMarket(id);
  const balances = useBalances(id);
  const profile = useProfile();
  const activity = useActivity();
  const [period, setPeriod] = useState<ChartPeriod>('1D');
  const [selected, setSelected] = useState<TxView | null>(null);
  const history = usePriceHistory(id, period);
  const p = market?.priceMicro ?? 0n;
  const b = balances.data;
  const total = b ? b.available + b.reserved + b.pendingYield + b.yield + b.collateral : 0n;
  const pct = history.data?.pct ?? 0;
  const suffix = chartPeriods.find((x) => x.id === period)?.suffix ?? '';
  const verified = profile.data?.kycStatus === 'verified';
  const txs = activity.views.filter((t) => t.asset === id).slice(0, 5);
  const acts: Act[] = [
    { label: 'Deposit', icon: 'deposit', path: '/deposit' },
    { label: 'Withdraw', icon: 'withdraw', path: '/withdraw' },
    { label: 'Exchange', icon: 'exchange', path: '/exchange' },
    ...(spec.yieldAprBps !== null ? [{ label: 'Earn', icon: 'sprout' as IconName, path: '/earn' as const }] : []),
  ];
  const usd = (units: bigint) => m.money(unitsToCents(units, p, id));
  const change7d = market?.change7dBps;

  return (
    <Screen>
      <ScrollBody>
        <TopBar title={spec.name} leadingLabel="Back" trailing={<IconButton icon="markets" label="All markets" onPress={() => router.push('/markets')} />} />
        <Card clip={false} style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <CoinLogo asset={id} size={44} />
            <View style={{ gap: 2, flex: 1 }}>
              <T size={13} color="text2">{`${id} price · ${spec.network}`}</T>
              <T size={28} weight={500} ls={-0.02} lh={1.1} num>
                {p ? m.price(p) : '—'}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <T size={13} weight={500} num color={pct >= 0 ? 'pos' : 'neg'}>
              {`${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`}
            </T>
            <T size={13} color="text3">
              {suffix}
            </T>
          </View>
          <View style={{ marginTop: 12, marginBottom: 6 }}>
            {history.data ? (
              <AreaChart
                values={history.data.values}
                height={120}
                ariaLabel={`${spec.name} price chart, ${suffix}, ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(2)} percent`}
              />
            ) : (
              <View style={{ height: 120 }} />
            )}
          </View>
          <PeriodChips label="Chart period" options={PERIOD_IDS} value={period} onChange={setPeriod} />
          <T size={11.5} color="text3" style={{ marginTop: 10 }}>
            {market?.live && history.data?.live
              ? `Live · updated ${hmz(market.updatedAt)}`
              : 'Live market data is unavailable right now; values may be out of date'}
          </T>
        </Card>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {acts.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="link"
              accessibilityLabel={`${a.label} ${id}`}
              accessibilityState={{ disabled: !verified && a.path !== '/deposit' }}
              onPress={() => router.push({ pathname: a.path, params: { asset: id } })}
              style={({ pressed }) => ({
                flex: 1,
                height: 72,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 12,
                backgroundColor: pressed ? c.sunken : c.surface,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: verified || a.path === '/deposit' ? 1 : 0.5,
              })}
            >
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.icon} size="sm" color="onAccent" />
              </View>
              <T size={12.5} weight={500}>
                {a.label}
              </T>
            </Pressable>
          ))}
        </View>

        <Sec top={22}>{`Your ${id}`}</Sec>
        <Card>
          <Row first>
            <T weight={600} style={{ flex: 1 }}>
              Total in custody
            </T>
            <View style={{ alignItems: 'flex-end' }}>
              <T weight={600} num>
                {formatAmount(total, id)}
              </T>
              <T size={12} color="text3" num>
                {usd(total)}
              </T>
            </View>
          </Row>
          <Row>
            <T color="text2" style={{ flex: 1 }}>
              Available
            </T>
            <T weight={500} num>
              {formatAmount(b?.available ?? 0n, id)}
            </T>
          </Row>
          <Row onPress={() => router.push({ pathname: '/earn', params: { asset: id } })} accessibilityRole="link" chevron>
            <T color="text2" style={{ flex: 1 }}>
              Allocated to yield
            </T>
            <T weight={500} num>
              {formatAmount((b?.yield ?? 0n) + (b?.pendingYield ?? 0n), id)}
            </T>
          </Row>
          <Row onPress={() => router.push('/borrow')} accessibilityRole="link" chevron>
            <T color="text2" style={{ flex: 1 }}>
              Locked as collateral
            </T>
            <T weight={500} num>
              {formatAmount(b?.collateral ?? 0n, id)}
            </T>
          </Row>
          {b && b.reserved > 0n ? (
            <Row>
              <T color="text2" style={{ flex: 1 }}>
                Reserved for withdrawals
              </T>
              <T weight={500} num>
                {formatAmount(b.reserved, id)}
              </T>
            </Row>
          ) : null}
        </Card>

        <Sec top={22}>Market statistics</Sec>
        {market?.live ? (
          <Card>
            <KV
              fixedKeys
              num
              items={[
                { k: 'Market cap', v: m.compact(market.marketCapUsd), sub: market.rank ? `Rank #${market.rank}` : undefined },
                { k: '24h volume', v: m.compact(market.volume24hUsd) },
                { k: '24h range', v: `${m.price(market.low24hMicro)} – ${m.price(market.high24hMicro)}` },
                { k: '24h change', v: `${market.changeBps >= 0 ? '+' : '−'}${Math.abs(market.changeBps / 100).toFixed(2)}%` },
                ...(change7d !== null && change7d !== undefined ? [{ k: '7d change', v: `${change7d >= 0 ? '+' : '−'}${Math.abs(change7d / 100).toFixed(2)}%` }] : []),
                { k: 'All-time high', v: m.price(market.athMicro), sub: market.athDate ? md(market.athDate) + ` ${new Date(market.athDate).getFullYear()}` : undefined },
                { k: 'Circulating supply', v: `${compactNumber(market.circulatingSupply)} ${id}` },
                { k: 'Max supply', v: market.maxSupply ? `${compactNumber(market.maxSupply)} ${id}` : 'No fixed cap' },
              ]}
            />
          </Card>
        ) : (
          <Banner tone="info" icon="info">
            Market statistics appear when live data is available.
          </Banner>
        )}

        <Sec top={22}>{`${id} activity`}</Sec>
        <Card>
          {txs.map((t, i) => (
            <TxRow key={t.id} tx={t} first={i === 0} minHeight={56} onPress={() => setSelected(t)} />
          ))}
          {txs.length === 0 ? (
            <T size={13.5} color="text3" align="center" style={{ paddingVertical: 24 }}>
              {`No ${id} activity yet.`}
            </T>
          ) : null}
        </Card>

        <Sec top={22}>{`About ${id} here`}</Sec>
        <Card>
          <KV
            fixedKeys
            items={[
              { k: 'Network', v: spec.network },
              {
                k: 'Deposits',
                v: spec.deposit === 'automatic' ? 'Shared address + destination tag, credited automatically' : 'Platform address; confirmed by our team, then credited',
              },
              { k: 'Minimum deposit', v: formatAmount(lim.minDeposit, id, { minDecimals: 0, maxDecimals: 8 }) },
              { k: 'Withdrawal fee', v: formatAmount(lim.withdrawalFee, id, { minDecimals: 0, maxDecimals: 8 }) },
              { k: 'Yield', v: spec.yieldAprBps !== null ? `${(spec.yieldAprBps / 100).toFixed(2)}% APR · variable` : 'Not offered yet' },
              { k: 'Loan collateral', v: spec.collateral ? 'Accepted' : 'Not accepted yet' },
            ]}
          />
        </Card>
        <T size={12} lh={1.5} color="text3" style={{ marginTop: 12, marginHorizontal: 4 }}>
          {`Only ${id} on ${spec.network} is supported. Sending it on another network, or sending another token, may lose the funds.`}
        </T>
      </ScrollBody>
      <TxDetailSheet tx={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
};
