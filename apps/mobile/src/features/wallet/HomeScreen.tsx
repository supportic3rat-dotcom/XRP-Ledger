import { asset as assetSpec, formatAmount, formatUsd, splitUsd, unitsToCents } from '@xrp/ledger';
import { chartPeriods } from '@xrp/providers';
import type { IconName } from '@xrp/tokens';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Pill } from '@/components/Badge';
import { Card } from '@/components/Card';
import { AreaChart } from '@/components/Charts';
import { PeriodChips } from '@/components/Chips';
import { CoinLogo } from '@/components/CoinLogo';
import { BrandMark, Icon } from '@/components/Icon';
import { Row } from '@/components/Row';
import { Segmented } from '@/components/Segmented';
import { IconButton } from '@/components/IconButton';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Grab, Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { TxDetailSheet } from '@/components/TxDetailSheet';
import { TxRow } from '@/components/TxRow';
import type { TxView } from '@/data/describeTx';
import { useActivity, useHoldings, useLoan, useMarkets, useNotifications, usePortfolioHistory, usePriceMap, useProfile, useYieldPositions } from '@/data/hooks';
import { PERIOD_IDS } from '@/data/series';
import { hm } from '@/lib/dates';
import { MASK, useHideAmounts } from '@/state/ui';
import { useTheme } from '@/theme';
import type { ChartPeriod } from '@xrp/providers';

type Action = { key: string; label: string; icon: IconName; href?: Href; needsVerified: boolean; element: 'a' | 'button' };
type HistoryFilter = 'all' | 'receive' | 'send' | 'exchange';
const HISTORY_FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'receive', label: 'Received' },
  { value: 'send', label: 'Sent' },
  { value: 'exchange', label: 'Exchanges' },
];
/** Which transaction kinds each history filter shows (as on the web dashboard). */
const HISTORY_KINDS: Record<Exclude<HistoryFilter, 'all'>, string[]> = {
  receive: ['deposit', 'yield_reward'],
  send: ['withdrawal'],
  exchange: ['exchange'],
};

const ACTIONS: Action[] = [
  { key: 'deposit', label: 'Deposit', icon: 'deposit', href: '/deposit', needsVerified: true, element: 'a' },
  { key: 'withdraw', label: 'Withdraw', icon: 'withdraw', href: '/withdraw', needsVerified: true, element: 'a' },
  { key: 'exchange', label: 'Exchange', icon: 'exchange', href: '/exchange', needsVerified: true, element: 'a' },
  { key: 'earn', label: 'Earn', icon: 'sprout', href: '/earn', needsVerified: true, element: 'a' },
  { key: 'borrow', label: 'Borrow', icon: 'borrow', href: '/borrow', needsVerified: true, element: 'a' },
  { key: 'history', label: 'History', icon: 'history', needsVerified: false, element: 'button' },
];

/** `.qa-btn` — 76 tall tile; `<a>` tiles 12.5/500, the History `<button>` inherits 14/400 (as in the design). */
const QuickAction = ({ a, off, onPress }: { a: Action; off: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={a.element === 'a' && !off ? 'link' : 'button'}
      accessibilityLabel={a.label}
      accessibilityState={{ disabled: off }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 76,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        backgroundColor: off ? c.sunken : pressed ? c.sunken : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      })}
    >
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: off ? c.border : c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={a.icon} size="sm" color={off ? 'text3' : 'accentText'} />
      </View>
      <T size={a.element === 'a' ? 12.5 : 14} weight={a.element === 'a' ? 500 : 400} color={off ? 'text3' : 'text'}>
        {a.label}
      </T>
    </Pressable>
  );
};

/** `.line` — swatch, label, value with a smaller secondary line. */
const Line = ({
  first,
  swatch,
  k,
  ks,
  v,
  vs,
}: {
  first?: boolean;
  swatch?: { color: string; opacity?: number };
  k: string;
  ks?: string;
  v: string;
  vs: string;
}) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.border,
      }}
    >
      {swatch ? (
        <View style={{ width: 8, height: 8, borderRadius: 2, alignSelf: 'center', backgroundColor: swatch.color, opacity: swatch.opacity ?? 1 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        <T size={13.5} color="text2">
          {k}
        </T>
        {ks ? (
          <T size={12} color="text3">
            {ks}
          </T>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T size={13.5} weight={500} num align="right">
          {v}
        </T>
        <T size={12} color="text3" num align="right">
          {vs}
        </T>
      </View>
    </View>
  );
};

/** `.link-btn` — 13/500 accent-text for `<a>`; the "History" `<button>` inherits the `.sec` font (13/600 text-2). */
const SecLink = ({ label, onPress, element }: { label: string; onPress: () => void; element: 'a' | 'button' }) => (
  <Pressable
    accessibilityRole={element === 'a' ? 'link' : 'button'}
    onPress={onPress}
    hitSlop={8}
    style={{ paddingVertical: 6, paddingHorizontal: 4, marginVertical: -6, marginHorizontal: -4 }}
  >
    <T size={13} weight={element === 'a' ? 500 : 600} color={element === 'a' ? 'accentText' : 'text2'}>
      {label}
    </T>
  </Pressable>
);

export const HomeScreen = () => {
  const router = useRouter();
  const { c } = useTheme();
  const profile = useProfile();
  const holdings = useHoldings();
  const { prices, live, at } = usePriceMap();
  const markets = useMarkets();
  const loan = useLoan();
  const positions = useYieldPositions();
  const notes = useNotifications();
  const activity = useActivity();
  const { hidden, toggle } = useHideAmounts();
  const [period, setPeriod] = useState<ChartPeriod>('1M');
  const [reason, setReason] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [selected, setSelected] = useState<TxView | null>(null);

  const cents = (units: bigint, a: string) => unitsToCents(units, prices[a] ?? 0n, a);
  const hs = holdings.data ?? [];
  const totalOf = (h: (typeof hs)[number]) => h.available + h.reserved + h.pendingYield + h.yield + h.collateral;
  const sumBy = (pick: (h: (typeof hs)[number]) => bigint) => hs.reduce((s, h) => s + cents(pick(h), h.asset), 0n);
  const bucket = {
    available: sumBy((h) => h.available),
    yield: sumBy((h) => h.yield + h.pendingYield),
    collateral: sumBy((h) => h.collateral),
    reserved: sumBy((h) => h.reserved),
  };
  const totalCents = bucket.available + bucket.yield + bucket.collateral + bucket.reserved;
  const assets = hs
    .map((h) => ({ asset: h.asset, units: totalOf(h), value: cents(totalOf(h), h.asset) }))
    .filter((x) => x.units > 0n)
    .sort((x, y) => (y.value > x.value ? 1 : y.value < x.value ? -1 : 0));
  const series = usePortfolioHistory(assets, period);
  const suffix = chartPeriods.find((p) => p.id === period)?.suffix ?? '';
  const verified = profile.data?.kycStatus === 'verified';
  const unread = (notes.data ?? []).filter((n) => !n.readAt).length;
  const pending = activity.raw.filter(
    (t) => t.kind === 'deposit' && !['credited', 'rejected', 'no_tag'].includes(t.status as string) && t.customerId === profile.data?.id,
  );
  const pendingCents = pending.reduce((s, t) => s + cents(t.amountDrops ?? 0n, t.asset), 0n);
  const owed = loan.data ? loan.data.principalCents + loan.data.interestCents : 0n;
  const accruedCents = (positions.data ?? []).reduce((s, p) => s + cents(p.estimatedAccruedDrops, p.asset), 0n);
  const change = useMemo(() => {
    const v = series.data?.values;
    if (!v?.length) return null;
    const startCents = BigInt(Math.round((v[0] ?? 0) * 100));
    const endCents = BigInt(Math.round((v[v.length - 1] ?? 0) * 100));
    const diff = endCents - startCents;
    return { diff, up: diff >= 0n, pct: Math.abs(series.data?.pct ?? 0).toFixed(2) };
  }, [series.data]);
  const [whole, centsPart] = splitUsd(totalCents);
  const money = (c: bigint) => (hidden ? MASK : formatUsd(c));
  const change24 = (a: string) => markets.data?.find((m) => m.asset === a)?.changeBps ?? 0;
  const recent = activity.views.slice(0, 3);
  const kindOf = new Map(activity.raw.map((t) => [t.id, t.kind]));
  const historyRows = activity.views.filter((t) => historyFilter === 'all' || HISTORY_KINDS[historyFilter].includes(kindOf.get(t.id) ?? ''));
  const empty = activity.views.length === 0 && totalCents === 0n && !activity.isLoading;
  const priceAt = at ? hm(at) : '';

  const onAction = (a: Action) => {
    if (a.key === 'history') {
      setHistory(true);
      return;
    }
    if (a.needsVerified && !verified) {
      setReason(`${a.label} is unavailable until your identity is verified.`);
      return;
    }
    if (a.href) router.push(a.href);
  };

  return (
    <Screen>
      <ScrollBody top={8} bottom={112}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 }}>
          <BrandMark size={28} />
          <Pressable accessibilityRole="link" accessibilityLabel="Custodial account" onPress={() => router.push('/custody')} style={{ marginLeft: 4 }}>
            <Pill height={30}>
              <Icon name="shield" size="xs" color="accentText" />
              <T size={12} weight={500} color="accentText">
                Custodial account
              </T>
            </Pill>
          </Pressable>
          <View style={{ flex: 1 }} />
          <IconButton
            icon="bell"
            label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            dot={unread > 0}
            onPress={() => router.push('/notifications')}
          />
        </View>

        <Card clip={false} style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 12, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={13} weight={500} color="text2" accessibilityRole="header">
              Total custodial value
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'} onPress={toggle} hitSlop={14}>
              <Icon name="eye" size="sm" color="text3" />
            </Pressable>
          </View>
          <T size={36} weight={500} ls={-0.03} lh={1.1} num style={{ marginTop: 6 }}>
            {hidden ? (
              MASK
            ) : (
              <>
                {whole}
                <T size={36} weight={500} ls={-0.03} lh={1.1} num color="text3">
                  {centsPart}
                </T>
              </>
            )}
          </T>
          {change && !hidden ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <T size={13} weight={500} num color={change.up ? 'pos' : 'neg'}>
                {`${change.up ? '+' : '−'}${formatUsd(change.diff < 0n ? -change.diff : change.diff)} (${change.pct}%)`}
              </T>
              <T size={13} color="text3">
                {suffix}
              </T>
            </View>
          ) : (
            <View style={{ height: 24.2 }} />
          )}
          <View style={{ marginTop: 14, marginBottom: 6 }}>
            {series.data ? (
              <AreaChart
                values={series.data.values}
                height={112}
                ariaLabel={`Custodial value chart, ${suffix}, ${change?.up ? 'up' : 'down'} ${change?.pct ?? '0'} percent`}
              />
            ) : (
              <View style={{ height: 112 }} />
            )}
          </View>
          <PeriodChips label="Chart period" options={PERIOD_IDS} value={period} onChange={setPeriod} />
          <T size={11.5} color="text3" style={{ marginTop: 10 }}>
            {live
              ? `Live prices · updated ${priceAt} WAT. Change reflects price only, not deposits or withdrawals.`
              : 'Sample prices: live market data is unavailable. Your balances are unaffected.'}
          </T>
        </Card>

        {!live && !holdings.isLoading ? (
          <Banner tone="warn" icon="alert" alert style={{ marginTop: 10 }}>
            Live prices aren’t available right now. USD values use sample prices; your coin balances are unaffected.
          </Banner>
        ) : null}

        <Sec top={20}>Quick actions</Sec>
        <View style={{ gap: 8 }}>
          {[ACTIONS.slice(0, 3), ACTIONS.slice(3)].map((row, r) => (
            <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
              {row.map((a) => (
                <QuickAction key={a.key} a={a} off={a.needsVerified && !verified} onPress={() => onAction(a)} />
              ))}
            </View>
          ))}
        </View>
        {reason && !verified ? (
          <Banner tone="info" icon="lock" style={{ marginTop: 10 }} trailing={<SecLink element="a" label="Verify" onPress={() => router.push('/verify')} />}>
            {reason}
          </Banner>
        ) : null}

        {empty ? (
          <Card style={{ marginTop: 24, padding: 16, gap: 10 }}>
            <T weight={600}>No deposits yet</T>
            <T size={13.5} lh={1.45} color="text2">
              Fund your account by depositing any supported coin — XRP, Bitcoin, Ethereum, USDT and more. It appears here once it’s confirmed.
            </T>
            <SecLink element="a" label="Deposit" onPress={() => onAction(ACTIONS[0]!)} />
          </Card>
        ) : (
          <>
            <Sec trailing={<SecLink element="a" label="Markets" onPress={() => router.push('/markets')} />}>{`Your assets · ${assets.length}`}</Sec>
            <Card>
              {assets.map((x, i) => {
                const ch = change24(x.asset);
                return (
                  <Row
                    key={x.asset}
                    first={i === 0}
                    minHeight={62}
                    onPress={() => router.push(`/asset/${x.asset}`)}
                    accessibilityRole="link"
                    accessibilityLabel={`${assetSpec(x.asset).name}, ${hidden ? 'hidden' : `${formatAmount(x.units, x.asset)}, ${formatUsd(x.value)}`}. Show details`}
                    chevron
                  >
                    <CoinLogo asset={x.asset} size={36} />
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <T weight={500} numberOfLines={1}>
                        {assetSpec(x.asset).name}
                      </T>
                      <T size={12} num rawColor={ch >= 0 ? c.pos : c.neg}>
                        {`${ch >= 0 ? '+' : '−'}${Math.abs(ch / 100).toFixed(2)}% today`}
                      </T>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T size={14} weight={500} num>
                        {money(x.value)}
                      </T>
                      <T size={12} color="text3" num>
                        {hidden ? MASK : formatAmount(x.units, x.asset)}
                      </T>
                    </View>
                  </Row>
                );
              })}
            </Card>

            <Sec>Where your money is</Sec>
            <Card>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ flexDirection: 'row', height: 8, marginTop: 14, marginHorizontal: 14, marginBottom: 4, borderRadius: 4, overflow: 'hidden', gap: 2 }}
              >
                <View style={{ flex: Number(bucket.available), backgroundColor: c.accent }} />
                <View style={{ flex: Number(bucket.yield), backgroundColor: c.accent, opacity: 0.55 }} />
                <View style={{ flex: Number(bucket.collateral), backgroundColor: c.text3, opacity: 0.6 }} />
                {bucket.reserved > 0n ? <View style={{ flex: Number(bucket.reserved), backgroundColor: c.borderStrong }} /> : null}
              </View>
              <Line swatch={{ color: c.accent }} k="Available" v={money(bucket.available)} vs="Ready to send, swap or earn" />
              <Line swatch={{ color: c.accent, opacity: 0.55 }} k="Allocated to yield" v={money(bucket.yield)} vs="Earning in Flexible products" />
              <Line swatch={{ color: c.text3, opacity: 0.6 }} k="Locked as loan collateral" v={money(bucket.collateral)} vs="Released when repaid" />
              <Line swatch={{ color: c.borderStrong }} k="Reserved for withdrawals" v={money(bucket.reserved)} vs="Waiting to be sent" />
            </Card>

            <Sec>Not included in the total</Sec>
            <Card>
              <Line
                first
                k="Pending deposits"
                ks="Credited once confirmed"
                v={money(pendingCents)}
                vs={pending.length === 1 ? '1 deposit' : `${pending.length} deposits`}
              />
              <Line k="Outstanding borrowing" ks="Principal + accrued interest" v={hidden ? MASK : formatUsd(owed)} vs={loan.data ? '1 loan' : 'No loans'} />
              <Line
                k="Estimated accrued rewards"
                ks="Not yet confirmed or credited"
                v={hidden ? MASK : `≈ ${formatUsd(accruedCents)}`}
                vs={`${(positions.data ?? []).filter((p) => p.allocatedDrops > 0n).length} positions`}
              />
            </Card>
          </>
        )}

        <Sec trailing={<SecLink element="button" label="History" onPress={() => setHistory(true)} />}>Recent activity</Sec>
        <Card>
          {recent.map((t, i) => (
            <TxRow key={t.id} tx={t} first={i === 0} onPress={() => setSelected(t)} />
          ))}
          {recent.length === 0 ? (
            <T size={13.5} color="text3" align="center" style={{ paddingVertical: 24 }}>
              No activity yet.
            </T>
          ) : null}
        </Card>
      </ScrollBody>

      <Sheet open={history} onClose={() => setHistory(false)} scrim="home" maxHeight={0.82} accessibilityLabel="Transaction history">
        <Grab />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4, marginBottom: 12 }}>
          <T size={18} weight={600} accessibilityRole="header">
            Transaction history
          </T>
          <IconButton icon="close" label="Close" onPress={() => setHistory(false)} style={{ marginRight: -10 }} />
        </View>
        <Segmented
          label="Filter transactions"
          value={historyFilter}
          onChange={setHistoryFilter}
          options={HISTORY_FILTERS}
          style={{ marginBottom: 12 }}
        />
        <Card>
          {historyRows.map((t, i) => (
            <TxRow key={t.id} tx={t} first={i === 0} onPress={() => setSelected(t)} />
          ))}
          {historyRows.length === 0 ? (
            <T size={13} color="text3" align="center" style={{ paddingVertical: 28, paddingHorizontal: 16 }}>
              No transactions match this filter.
            </T>
          ) : null}
        </Card>
      </Sheet>
      <TxDetailSheet tx={selected} onClose={() => setSelected(null)} stacked={history} closeLabel={history ? 'Back to history' : 'Close'} />
    </Screen>
  );
};
