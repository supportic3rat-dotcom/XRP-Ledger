import { asset as assetSpec, formatAmount, formatUnitsPrecise, isAssetId, parseUnits, percentOf, simpleInterest, unitsToCents } from '@xrp/ledger';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AssetSelect } from '@/components/AssetPicker';
import { Badge } from '@/components/Badge';
import { Banner } from '@/components/Banner';
import { Bullets } from '@/components/Bullets';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PillChips } from '@/components/Chips';
import { CoinLogo } from '@/components/CoinLogo';
import { CheckRow, Field, Label, TextField } from '@/components/Form';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Grab, Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { useToast } from '@/components/Toast';
import { api } from '@/data';
import { useApiMutation, useAssets, useHoldings, usePriceMap, useProfile, useYieldPositions } from '@/data/hooks';
import { flexibleProduct } from '@/data/products';
import { md, mdhm } from '@/lib/dates';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useMoney } from '@/lib/money';
import { useTheme } from '@/theme';
import { slopFor } from '@/components/hitSlop';
import { LiveAccrual } from './LiveAccrual';

const DURATIONS = [
  { d: 10, l: '10 days' },
  { d: 30, l: '30 days' },
  { d: 90, l: '90 days' },
  { d: 180, l: '180 days' },
  { d: 365, l: '1 year' },
  { d: 0, l: 'Custom' },
];

/** Inline "All" button in the withdraw sheet (inline styles: 12.5/500). */
const AllButton = ({ onPress }: { onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Withdraw all"
      onPress={onPress}
      hitSlop={slopFor(32)}
      style={{
        height: 32,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: c.borderStrong,
        borderRadius: 8,
        backgroundColor: c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T size={12.5} weight={500}>
        All
      </T>
    </Pressable>
  );
};

const Suffix = ({ asset }: { asset: string }) => (
  <T weight={500} color="text2">
    {asset}
  </T>
);

/**
 * Earn: a Flexible yield product per asset, live accrual on each position, and a rewards calculator.
 * Run by the platform: allocations and withdrawals are instant, and rewards are paid daily at the variable rate.
 */
export const EarnScreen = () => {
  const showToast = useToast((s) => s.show);
  const params = useLocalSearchParams<{ asset?: string }>();
  const positions = useYieldPositions();
  const holdings = useHoldings();
  const assets = useAssets();
  const { prices } = usePriceMap();
  const m = useMoney();
  const profile = useProfile();
  const allocate = useApiMutation(api.allocateYield);
  const redeem = useApiMutation(api.redeemYield);
  const offered = (assets.data ?? [])
    .filter((a) => a.yieldAprBps !== null)
    .sort((x, y) => (y.yieldAprBps ?? 0) - (x.yieldAprBps ?? 0));
  const [sel, setSel] = useState<string>(params.asset && isAssetId(params.asset) && assetSpec(params.asset).yieldAprBps !== null ? params.asset : 'XRP');
  const [calcAsset, setCalcAsset] = useState<string>(sel);
  const [calcAmount, setCalcAmount] = useState(sel === 'XRP' ? '1000' : '');
  const [dur, setDur] = useState(90);
  const [customDays, setCustomDays] = useState('45');
  const [sheet, setSheet] = useState<'risk' | 'alloc' | 'redeem' | null>(null);
  const [sheetAsset, setSheetAsset] = useState<string>(sel);
  const [alloc, setAlloc] = useState('');
  const [terms, setTerms] = useState(false);
  const [allocTried, setAllocTried] = useState(false);
  const [redeemAmt, setRedeemAmt] = useState('');
  const [redeemTried, setRedeemTried] = useState(false);
  const idem = useRef(newIdempotencyKey());

  const aprOf = (id: string) => offered.find((a) => a.id === id)?.yieldAprBps ?? assetSpec(id).yieldAprBps;
  const product = flexibleProduct(sel, aprOf(sel));
  const sheetProduct = flexibleProduct(sheetAsset, aprOf(sheetAsset));
  const calcProduct = flexibleProduct(calcAsset, aprOf(calcAsset));
  const verified = profile.data?.kycStatus === 'verified';
  const active = (positions.data ?? []).filter((p) => p.allocatedDrops > 0n);
  const availableOf = (id: string) => holdings.data?.find((h) => h.asset === id)?.available ?? 0n;
  const allocatedOf = (id: string) => (positions.data ?? []).find((p) => p.asset === id)?.allocatedDrops ?? 0n;
  const usd = (units: bigint, id: string) => m.money(unitsToCents(units, prices[id] ?? 0n, id));
  const totalEarningCents = active.reduce((s, p) => s + unitsToCents(p.allocatedDrops, prices[p.asset] ?? 0n, p.asset), 0n);

  const days = dur === 0 ? Math.max(0, parseInt(customDays, 10) || 0) : dur;
  const calcUnits = parseUnits(calcAmount, calcAsset) ?? 0n;
  const gross = calcProduct ? simpleInterest(calcUnits, calcProduct.aprBps, days) : 0n;
  const fee = calcProduct ? percentOf(gross, calcProduct.feeBps) : 0n;
  const est = (units: bigint) => `≈ ${formatAmount(units, calcAsset, { minDecimals: 2, maxDecimals: 8 })}`;

  const sheetAvailable = availableOf(sheetAsset);
  const sheetAllocated = allocatedOf(sheetAsset);
  const a = parseUnits(alloc, sheetAsset);
  const minAlloc = sheetProduct?.minDrops ?? 0n;
  const allocErr = !allocTried
    ? ''
    : a === null || a === 0n
      ? 'Enter an amount.'
      : a < minAlloc
        ? `The minimum allocation is ${formatAmount(minAlloc, sheetAsset, { minDecimals: 0, maxDecimals: 8 })}.`
        : a > sheetAvailable
          ? 'That’s more than your available balance.'
          : !terms
            ? 'Accept the product terms to continue.'
            : '';
  const r = parseUnits(redeemAmt, sheetAsset);
  const redeemErr = !redeemTried ? '' : r === null || r === 0n ? 'Enter an amount.' : r > sheetAllocated ? `You have ${formatAmount(sheetAllocated, sheetAsset)} allocated.` : '';

  const openAlloc = (id: string) => {
    setSheetAsset(id);
    setAlloc('');
    setTerms(false);
    setAllocTried(false);
    setSheet('alloc');
  };
  const openRedeem = (id: string) => {
    setSheetAsset(id);
    setRedeemAmt('');
    setRedeemTried(false);
    setSheet('redeem');
  };

  const submitAlloc = async () => {
    if (!(a !== null && a >= minAlloc && a <= sheetAvailable && terms)) {
      setAllocTried(true);
      return;
    }
    await allocate.mutateAsync({ idempotencyKey: idem.current, asset: sheetAsset, amountDrops: a });
    idem.current = newIdempotencyKey();
    setSheet(null);
    showToast('Allocated · earning from now.', { durationMs: 3200 });
  };
  const submitRedeem = async () => {
    if (r === null || r === 0n || r > sheetAllocated) {
      setRedeemTried(true);
      return;
    }
    await redeem.mutateAsync({ idempotencyKey: idem.current, asset: sheetAsset, amountDrops: r });
    idem.current = newIdempotencyKey();
    setSheet(null);
    showToast('Back in your available balance.', { durationMs: 3200 });
  };

  return (
    <Screen>
      <ScrollBody bottom={112}>
        <T size={24} weight={600} ls={-0.02} style={{ marginTop: 8, marginHorizontal: 4, marginBottom: 4 }} accessibilityRole="header">
          Earn
        </T>
        <T size={13} color="text3" style={{ marginHorizontal: 4, marginBottom: 16 }}>
          {active.length
            ? `${m.money(totalEarningCents)} earning across ${active.length} ${active.length === 1 ? 'asset' : 'assets'}. Rates can change; rewards aren’t guaranteed.`
            : 'Rates are variable and can change. Rewards aren’t guaranteed.'}
        </T>

        {active.map((pos) => {
          const pp = flexibleProduct(pos.asset, pos.aprBps);
          return (
            <Card key={pos.product} style={{ paddingTop: 16, paddingBottom: 6, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingBottom: 10 }}>
                <CoinLogo asset={pos.asset} size={40} />
                <View style={{ gap: 4, flex: 1 }}>
                  <T size={13} weight={500} color="text2" accessibilityRole="header">
                    {`Your position · ${pp?.name ?? pos.product}`}
                  </T>
                  <T size={24} weight={500} ls={-0.02} num>
                    {formatAmount(pos.allocatedDrops, pos.asset)}
                  </T>
                  <T size={12.5} color="text3" num>{`≈ ${usd(pos.allocatedDrops, pos.asset)} · since ${md(pos.since)}`}</T>
                </View>
                <Badge label="Active" tone="ok" />
              </View>
              <KV
                num
                rowPad={10}
                items={[
                  { k: 'Credited to your balance', sub: 'Paid out after fee, spendable', v: formatAmount(pos.creditedDrops, pos.asset) },
                  { k: 'Earned today', sub: 'Paid out daily', v: formatAmount(pos.estimatedAccruedDrops, pos.asset) },
                ]}
              />
              <LiveAccrual pos={pos} asOf={positions.dataUpdatedAt} priceMicro={prices[pos.asset]} />
              <View style={{ flexDirection: 'row', gap: 10, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
                <Button label="Withdraw" variant="secondary" size={48} flex={1} onPress={() => openRedeem(pos.asset)} />
                <Button label="Add more" size={48} flex={1} disabled={!verified} onPress={() => openAlloc(pos.asset)} />
              </View>
            </Card>
          );
        })}

        <Sec
          trailing={
            <T size={13} weight={500} color="text3">
              {`${offered.length} assets`}
            </T>
          }
        >
          Flexible products
        </Sec>
        <Card>
          {offered.map((o, i) => (
            <Row
              key={o.id}
              first={i === 0}
              minHeight={60}
              accessibilityRole="button"
              accessibilityState={{ selected: o.id === sel }}
              accessibilityLabel={`${o.name} Flexible, ${((o.yieldAprBps ?? 0) / 100).toFixed(2)} percent APR. Show details`}
              onPress={() => setSel(o.id)}
            >
              <CoinLogo asset={o.id} size={34} />
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <T weight={500}>{`${o.id} Flexible`}</T>
                <T size={12} color="text3" numberOfLines={1}>
                  {allocatedOf(o.id) > 0n ? `${formatAmount(allocatedOf(o.id), o.id)} allocated` : `Min ${formatAmount(o.limits.minProduct, o.id, { minDecimals: 0, maxDecimals: 8 })} · no lock-up`}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T size={16} weight={600} color="accentText" num>{`${((o.yieldAprBps ?? 0) / 100).toFixed(2)}%`}</T>
                <T size={11} color="text3">
                  APR
                </T>
              </View>
            </Row>
          ))}
        </Card>

        {product ? (
          <Card style={{ marginTop: 12 }}>
            <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 6, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
                <CoinLogo asset={sel} size={32} />
                <View style={{ gap: 3, flex: 1 }}>
                  <T size={15} weight={600} accessibilityRole="header">
                    {product.name}
                  </T>
                  <T size={12.5} color="text3">Paid daily by the platform</T>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <T size={20} weight={600} color="accentText" num>{`${(product.aprBps / 100).toFixed(2)}%`}</T>
                <T size={11.5} color="text3">
                  APR · variable · sample
                </T>
              </View>
            </View>
            <KV
              num
              rowPad={10}
              items={[
                { k: 'Minimum', v: formatAmount(product.minDrops, sel, { minDecimals: 0, maxDecimals: 8 }) },
                { k: 'Lock-up', v: product.lockUp },
                { k: 'Withdrawal', v: product.withdrawal },
                { k: 'Platform fee', v: `${product.feeBps / 100}% of rewards` },
                { k: 'Eligibility', v: product.eligibility },
                { k: 'Your available', v: formatAmount(availableOf(sel), sel) },
                { k: 'Rate last updated', v: `${mdhm(product.rateUpdatedAt)} WAT` },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: 10, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
              <Button
                label="Risks"
                variant="secondary"
                size={48}
                flex={1}
                onPress={() => {
                  setSheetAsset(sel);
                  setSheet('risk');
                }}
              />
              <Button
                label={`Allocate ${sel}`}
                size={48}
                flex={1.4}
                disabled={!verified}
                accessibilityHint={verified ? undefined : `Verify your identity to allocate ${sel}`}
                onPress={() => openAlloc(sel)}
              />
            </View>
          </Card>
        ) : null}

        <Sec>Estimate rewards</Sec>
        <Card style={{ padding: 16, gap: 14 }}>
          <Field>
            <Label>Asset</Label>
            <AssetSelect
              label="Asset to estimate"
              value={calcAsset}
              assets={offered.map((o) => ({ id: o.id, name: o.name, network: `${((o.yieldAprBps ?? 0) / 100).toFixed(2)}% APR · variable` }))}
              onChange={(id) => {
                setCalcAsset(id);
                setCalcAmount('');
              }}
              height={52}
            />
          </Field>
          <Field>
            <Label nativeID="calc-amt">Amount</Label>
            <TextField
              accessibilityLabelledBy="calc-amt"
              height={48}
              size={16}
              num
              value={calcAmount}
              onChangeText={(v) => setCalcAmount(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              trailing={<Suffix asset={calcAsset} />}
            />
          </Field>
          <Field>
            <Label nativeID="calc-dur">Duration</Label>
            <PillChips variant="earn" chips={DURATIONS.map((d) => ({ label: d.l, on: dur === d.d, onPress: () => setDur(d.d) }))} />
            {dur === 0 ? (
              <TextField
                accessibilityLabel="Custom days"
                height={48}
                size={16}
                num
                value={customDays}
                onChangeText={(v) => setCustomDays(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                wrapStyle={{ marginTop: 4 }}
                trailing={
                  <T weight={500} color="text2">
                    days
                  </T>
                }
              />
            ) : null}
          </Field>
          <KV
            num
            padX={0}
            padY={0}
            rowPad={10}
            items={[
              { k: 'Estimated gross rewards', v: est(gross), sub: usd(gross, calcAsset) },
              { k: `Platform fee (${(calcProduct?.feeBps ?? 0) / 100}%)`, v: est(fee) },
              { k: 'Estimated net rewards', keyStrong: true, v: est(gross - fee), sub: `≈ ${usd(gross - fee, calcAsset)}`, valueSize: 15 },
            ]}
          />
          <T size={12} lh={1.5} color="text3">
            {`Simple interest: amount × ${((calcProduct?.aprBps ?? 0) / 100).toFixed(2)}% × ${days} days ÷ 365. An estimate at today’s sample rate, not a promise of returns.`}
          </T>
        </Card>
      </ScrollBody>

      <Sheet open={sheet === 'risk'} onClose={() => setSheet(null)} scrim="green" shadow="soft" accessibilityLabel={`Risks of ${sheetAsset} Flexible`}>
        <Grab bottom={16} />
        <T size={18} weight={600} style={{ marginBottom: 12 }} accessibilityRole="header">
          {`Risks of ${sheetAsset} Flexible`}
        </T>
        <Bullets
          items={[
            'The rate is variable and set by us. It can fall to zero.',
            `Allocated ${sheetAsset} stays with us in your account. Rewards are paid from our revenue and aren’t guaranteed.`,
            'You can withdraw any time; it’s back in your available balance at once.',
            `Rewards are paid in ${sheetAsset}, so their USD value moves with the ${sheetAsset} price.`,
          ]}
        />
        <Button label="Close" variant="secondary" size={48} onPress={() => setSheet(null)} style={{ marginTop: 20 }} />
      </Sheet>

      <Sheet open={sheet === 'alloc'} onClose={() => setSheet(null)} scrim="green" shadow="soft" accessibilityLabel={`Allocate to ${sheetAsset} Flexible`}>
        <Grab bottom={16} />
        <T size={18} weight={600} style={{ marginBottom: 4 }} accessibilityRole="header">
          {`Allocate to ${sheetAsset} Flexible`}
        </T>
        <T size={13} color="text3" style={{ marginBottom: 14 }}>{`Available ${formatAmount(sheetAvailable, sheetAsset)}`}</T>
        <TextField
          accessibilityLabel="Amount to allocate"
          height={48}
          size={16}
          num
          value={alloc}
          onChangeText={(v) => setAlloc(v.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          invalid={!!allocErr}
          placeholder="0.00"
          trailing={<Suffix asset={sheetAsset} />}
        />
        {allocErr ? (
          <T size={12.5} color="neg" accessibilityRole="alert" style={{ marginTop: 6 }}>
            {allocErr}
          </T>
        ) : a ? (
          <T size={12.5} color="text3" style={{ marginTop: 6 }} num>
            {`≈ ${usd(a, sheetAsset)} · about ${formatAmount(simpleInterest(a, sheetProduct?.aprBps ?? 0, 365), sheetAsset, { minDecimals: 2, maxDecimals: 8 })} a year before fee`}
          </T>
        ) : null}
        <View style={{ gap: 12, marginTop: 16 }}>
          <CheckRow checked={terms} onChange={setTerms}>
            I’ve read the Yield Product Terms (draft v0.1) and Risk Disclosure.
          </CheckRow>
        </View>
        <Banner tone="info" style={{ marginTop: 14 }}>
          {`${sheetAsset} moves from Available to Allocated at once and starts earning.`}
        </Banner>
        <Button label="Submit allocation request" size={48} loading={allocate.isPending} onPress={submitAlloc} style={{ marginTop: 16 }} />
      </Sheet>

      <Sheet open={sheet === 'redeem'} onClose={() => setSheet(null)} scrim="green" shadow="soft" accessibilityLabel={`Withdraw from ${sheetAsset} Flexible`}>
        <Grab bottom={16} />
        <T size={18} weight={600} style={{ marginBottom: 4 }} accessibilityRole="header">
          {`Withdraw from ${sheetAsset} Flexible`}
        </T>
        <T size={13} color="text3" style={{ marginBottom: 14 }}>{`Allocated ${formatAmount(sheetAllocated, sheetAsset)}`}</T>
        <TextField
          accessibilityLabel="Amount to withdraw"
          height={48}
          size={16}
          num
          value={redeemAmt}
          onChangeText={(v) => setRedeemAmt(v.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="0.00"
          invalid={!!redeemErr}
          trailing={
            <>
              <AllButton onPress={() => setRedeemAmt(formatUnitsPrecise(sheetAllocated, sheetAsset).replace(/,/g, ''))} />
              <Suffix asset={sheetAsset} />
            </>
          }
        />
        {redeemErr ? (
          <T size={12.5} color="neg" accessibilityRole="alert" style={{ marginTop: 6 }}>
            {redeemErr}
          </T>
        ) : null}
        <KV
          num
          padX={0}
          padY={0}
          rowPad={10}
          style={{ marginTop: 12 }}
          items={[
            { k: 'Returns to', v: 'Available balance' },
            { k: 'Usually takes', v: sheetProduct?.withdrawal ?? '1–2 business days' },
            { k: 'Rewards on this amount', v: 'Stop once confirmed' },
          ]}
        />
        <Banner tone="info" style={{ marginTop: 12 }}>
          {`${sheetAsset} moves back to Available at once. Rewards earned so far are paid first.`}
        </Banner>
        <Button label="Request withdrawal" size={48} loading={redeem.isPending} onPress={submitRedeem} style={{ marginTop: 16 }} />
      </Sheet>
    </Screen>
  );
};
