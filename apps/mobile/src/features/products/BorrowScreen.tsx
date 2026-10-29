import Slider from '@react-native-community/slider';
import {
  asset as assetSpec,
  divRound,
  formatAmount,
  formatAssetPrice,
  formatBps,
  formatUsd,
  LIQUIDATION_BPS,
  ltvBps,
  ltvLevel,
  MARGIN_CALL_BPS,
  parseUnits,
  parseUsd,
  percentOf,
  thresholdPrice,
  unitsToCents,
} from '@xrp/ledger';
import { bankPayout, loanEstimateError } from '@xrp/schemas';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { AssetSelect } from '@/components/AssetPicker';
import { Badge, type BadgeTone } from '@/components/Badge';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow, Field, Label, TextField } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { KV } from '@/components/KV';
import { LtvMeter } from '@/components/LtvMeter';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Grab, Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { useToast } from '@/components/Toast';
import { api } from '@/data';
import { useApiMutation, useAssets, useBalances, useLoan, usePriceMap, useProfile } from '@/data/hooks';
import { lendingTerms } from '@/data/products';
import { md } from '@/lib/dates';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useMoney } from '@/lib/money';
import { useTheme } from '@/theme';

const LEVEL: Record<ReturnType<typeof ltvLevel>, { label: string; tone: BadgeTone }> = {
  ok: { label: 'Healthy', tone: 'ok' },
  watch: { label: 'Watch', tone: 'warn' },
  call: { label: 'Margin call', tone: 'warn' },
  liq: { label: 'Liquidation risk', tone: 'bad' },
};

/** `.req` row in the apply sheet. */
const Req = ({ first, done, label, note }: { first?: boolean; done: boolean; label: string; note?: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <Icon name={done ? 'check' : 'clock'} size="sm" color={done ? 'pos' : 'text3'} />
      <T size={13.5} style={{ flex: 1 }}>
        {label}
      </T>
      {note ? (
        <T size={12} color="text3">
          {note}
        </T>
      ) : null}
    </View>
  );
};

export const BorrowScreen = () => {
  const router = useRouter();
  const m = useMoney();
  const { c } = useTheme();
  const showToast = useToast((s) => s.show);
  const loan = useLoan();
  const { prices } = usePriceMap();
  const assets = useAssets();
  const [collAsset, setCollAsset] = useState('XRP');
  const balances = useBalances(collAsset);
  const profile = useProfile();
  const apply = useApiMutation(api.applyLoan);
  const idem = useRef(newIdempotencyKey());
  const [tryPrice, setTryPrice] = useState<number | null>(null);
  const [coll, setColl] = useState('2000');
  const [amt, setAmt] = useState('500');
  const [sheet, setSheet] = useState(false);
  const [terms, setTerms] = useState(false);
  const [lock, setLock] = useState(false);
  const [bank, setBank] = useState({ bank: '', accountNumber: '', accountName: '' });
  const [tried, setTried] = useState(false);

  const l = loan.data;
  const la = l?.collateralAsset ?? 'XRP';
  const ld = assetSpec(la).decimals;
  const loanPrice = prices[la] ?? 0n;
  const sim = tryPrice !== null ? BigInt(Math.round(tryPrice * 1e6)) : loanPrice;
  const owed = l ? l.principalCents + l.interestCents : 0n;
  const collDrops = l?.collateralDrops ?? 0n;
  const ltv = l ? ltvBps(owed, collDrops, sim, ld) : 0;
  const level = ltvLevel(ltv);
  const meterColor = level === 'ok' ? c.accent : level === 'liq' ? c.neg : c.dotWarn;
  const alert =
    level === 'call'
      ? 'LTV is above 65%. Add collateral or repay to bring it down before it reaches 80%.'
      : level === 'liq'
        ? 'At 80% LTV we sell collateral at the live price to repay the loan. Act now to avoid liquidation.'
        : '';

  const livePrice = prices[collAsset] ?? 0n;
  const cd = assetSpec(collAsset).decimals;
  const available = balances.data?.available ?? 0n;
  const cDrops = parseUnits(coll, collAsset) ?? 0n;
  const aCents = parseUsd(amt) ?? 0n;
  const cValue = unitsToCents(cDrops, livePrice, collAsset);
  const cap = cValue / 2n;
  const newLtv = cValue > 0n ? ltvBps(aCents, cDrops, livePrice, cd) : 0;
  const err = loanEstimateError(cDrops, aCents, available, newLtv, collAsset);
  const collateralOptions = (assets.data ?? []).filter((x) => x.collateral).map((x) => ({ id: x.id, name: x.name, network: x.network }));
  const verified = profile.data?.kycStatus === 'verified';

  const payout = bankPayout.safeParse(bank);
  const submit = async () => {
    if (!(terms && lock) || !payout.success) {
      setTried(true);
      return;
    }
    await apply.mutateAsync({ idempotencyKey: idem.current, asset: collAsset, collateralDrops: cDrops, principalCents: aCents, payout: payout.data });
    idem.current = newIdempotencyKey();
    setSheet(false);
    setTerms(false);
    setLock(false);
    showToast('Application submitted · our team reviews it, usually within one business day.', { durationMs: 3000 });
  };

  return (
    <Screen>
      <ScrollBody bottom={112}>
        <T size={24} weight={600} ls={-0.02} style={{ marginTop: 8, marginHorizontal: 4, marginBottom: 4 }} accessibilityRole="header">
          Borrow
        </T>
        <T size={13} color="text3" style={{ marginHorizontal: 4, marginBottom: 16 }}>
          {`USD loans against your crypto — ${collateralOptions.map((x) => x.id).join(', ')} — paid to your bank account.`}
        </T>

        {l ? (
          <Card clip={false} style={{ paddingTop: 16, paddingBottom: 8 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingBottom: 12 }}
            >
              <View style={{ gap: 4, flexShrink: 1 }}>
                <T size={13} weight={500} color="text2" accessibilityRole="header">
                  Active loan ·{' '}
                  <T size={13} weight={500} color="text2" mono>
                    {l.ref}
                  </T>
                </T>
                <T size={28} weight={500} ls={-0.02} num>
                  {formatUsd(owed)}
                </T>
                <T size={12.5} color="text3">{`Outstanding · ${formatUsd(l.principalCents)} principal + ${formatUsd(l.interestCents)} interest`}</T>
              </View>
              <Badge label={LEVEL[level].label} tone={LEVEL[level].tone} />
            </View>
            <View style={{ paddingTop: 4, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <T size={12.5} color="text2">
                  Loan-to-value
                </T>
                <T size={12.5} weight={600} num>
                  {formatBps(ltv)}
                </T>
              </View>
              <LtvMeter
                ltvPct={ltv / 100}
                color={meterColor}
                ariaLabel={`Loan-to-value ${(ltv / 100).toFixed(1)} percent. Margin call at 65, liquidation at 80.`}
              />
            </View>
            <KV
              num
              rowPad={10}
              style={{ marginTop: 10 }}
              items={[
                { k: 'Collateral', v: `${formatAmount(collDrops, la)} · ${formatUsd(unitsToCents(collDrops, sim, la))}` },
                { k: `${la} price (live)`, v: formatAssetPrice(sim) },
                { k: 'Margin call at', v: formatAssetPrice(thresholdPrice(owed, collDrops, l.marginBps ?? MARGIN_CALL_BPS, ld)) },
                { k: 'Liquidation at', v: formatAssetPrice(thresholdPrice(owed, collDrops, l.liquidationBps ?? LIQUIDATION_BPS, ld)) },
                { k: 'Interest', v: `${(l.aprBps / 100).toFixed(2)}% APR · fixed` },
                { k: 'Next interest due', v: md(l.nextInterestDue) },
              ]}
            />
            <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}>
              <T size={12.5} color="text3">
                Try a price:{' '}
                <T size={12.5} weight={600} num>
                  {formatAssetPrice(sim)}
                </T>
              </T>
              <Slider
                accessibilityLabel={`Simulated ${la} price`}
                minimumValue={(Number(loanPrice) / 1e6) * 0.3}
                maximumValue={(Number(loanPrice) / 1e6) * 1.5}
                step={Number(loanPrice) / 1e6 / 200}
                value={Number(loanPrice) / 1e6}
                onValueChange={(v) => setTryPrice(v)}
                minimumTrackTintColor={c.accent}
                maximumTrackTintColor={c.borderStrong}
                thumbTintColor={c.accent}
                style={{ width: '100%', height: 20 }}
              />
            </View>
            {alert ? (
              <View style={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 8 }}>
                <Banner tone={level === 'liq' ? 'error' : 'warn'} alert>
                  {alert}
                </Banner>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, paddingHorizontal: 16 }}>
              <Button
                as="a"
                label="Add collateral"
                variant="secondary"
                size={48}
                flex={1}
                onPress={() => router.push({ pathname: '/loan/manage', params: { mode: 'collateral' } })}
              />
              <Button as="a" label="Repay" size={48} flex={1} onPress={() => router.push({ pathname: '/loan/manage', params: { mode: 'repay' } })} />
            </View>
          </Card>
        ) : null}

        <Sec trailing={<Badge label="Indicative · not an offer" tone="warn" />}>New loan estimate</Sec>
        <Card style={{ padding: 16, gap: 14 }}>
          <Field>
            <Label>Collateral asset</Label>
            <AssetSelect
              label="Collateral asset"
              value={collAsset}
              assets={collateralOptions}
              onChange={(id) => {
                setCollAsset(id);
                setColl('');
              }}
              height={52}
            />
          </Field>
          <Field>
            <Label nativeID="b-coll">Collateral</Label>
            <TextField
              accessibilityLabelledBy="b-coll"
              height={48}
              size={16}
              num
              value={coll}
              onChangeText={(v) => setColl(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              trailing={
                <T weight={500} color="text2">
                  {collAsset}
                </T>
              }
            />
            <T size={12} color="text3">{`Available ${formatAmount(available, collAsset)} · this collateral is worth ${m.money(cValue)}`}</T>
          </Field>
          <Field>
            <Label nativeID="b-amt">Borrow</Label>
            <TextField
              accessibilityLabelledBy="b-amt"
              height={48}
              size={16}
              num
              value={amt}
              onChangeText={(v) => setAmt(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              invalid={newLtv > lendingTerms.maxStartLtvBps}
              leading={
                <T weight={500} color="text2">
                  $
                </T>
              }
              trailing={
                <T weight={500} color="text2">
                  USD
                </T>
              }
            />
            <T size={12} color="text3">{`You can request up to ${formatUsd(cap)}${m.equivalent(cap) ? ` (${m.equivalent(cap)})` : ''} at a 50% starting LTV. Loans are paid and repaid in US dollars.`}</T>
          </Field>
          <KV
            num
            padX={0}
            padY={0}
            rowPad={10}
            items={[
              { k: 'Starting LTV', v: formatBps(newLtv), valueColor: newLtv > lendingTerms.maxStartLtvBps ? 'neg' : 'text' },
              { k: `${collAsset} liquidation price (80% LTV)`, v: cDrops > 0n ? formatAssetPrice(thresholdPrice(aCents, cDrops, LIQUIDATION_BPS, cd)) : '—' },
              { k: 'Interest (10.00% APR, fixed)', v: `${formatUsd(divRound(aCents * BigInt(lendingTerms.aprBps), 10_000n * 12n))} / month` },
              { k: 'Origination fee (1%)', v: formatUsd(percentOf(aCents, lendingTerms.originationBps)) },
              { k: 'Remaining capacity', v: formatUsd(cap > aCents ? cap - aCents : 0n) },
            ]}
          />
          {err ? (
            <Banner tone="error" alert>
              {err}
            </Banner>
          ) : null}
          <Button
            label="Review and apply"
            size={48}
            disabled={!verified}
            accessibilityHint={verified ? undefined : 'Verify your identity to apply'}
            onPress={() => {
              if (err) return;
              setTried(false);
              setSheet(true);
            }}
          />
          <T size={12} lh={1.5} color="text3">
            Our team reviews each application. Repay any time; collateral is released once the loan is closed.
          </T>
        </Card>
      </ScrollBody>

      <Sheet open={sheet} onClose={() => setSheet(false)} scrim="green" shadow="soft" accessibilityLabel="Loan application">
        <Grab bottom={16} />
        <T size={18} weight={600} style={{ marginBottom: 4 }} accessibilityRole="header">{`Apply for ${formatUsd(aCents)}`}</T>
        <T size={13} color="text3" style={{ marginBottom: 14 }}>{`Against ${coll} ${collAsset} · starting LTV ${formatBps(newLtv)}`}</T>
        <Card style={{ paddingVertical: 2, paddingHorizontal: 14, marginBottom: 14 }}>
          <Req first done={verified} label="Identity verified" />
          <Req done={cDrops <= available} label="Collateral available" />
          <Req done={false} label="Credit review by our team" note="After you apply" />
        </Card>
        <T size={13} weight={600} color="text2" style={{ marginBottom: 8, marginHorizontal: 4 }}>
          Pay the loan to
        </T>
        <View style={{ gap: 10, marginBottom: 14 }}>
          <TextField accessibilityLabel="Bank" placeholder="Bank" value={bank.bank} onChangeText={(v) => setBank((b) => ({ ...b, bank: v }))} height={48} />
          <TextField
            accessibilityLabel="Account number"
            placeholder="Account number"
            value={bank.accountNumber}
            onChangeText={(v) => setBank((b) => ({ ...b, accountNumber: v }))}
            keyboardType="number-pad"
            autoCorrect={false}
            height={48}
          />
          <TextField
            accessibilityLabel="Account name"
            placeholder="Account name (must be yours)"
            value={bank.accountName}
            onChangeText={(v) => setBank((b) => ({ ...b, accountName: v }))}
            autoComplete="name"
            height={48}
          />
        </View>
        <View style={{ gap: 12 }}>
          <CheckRow checked={terms} onChange={setTerms}>
            I accept the Lending and Collateral Agreement (draft v0.1).
          </CheckRow>
          <CheckRow checked={lock} onChange={setLock}>
            {`Lock ${coll} ${collAsset} as collateral. It can be sold if LTV reaches 80%.`}
          </CheckRow>
        </View>
        {tried && !(terms && lock && payout.success) ? (
          <T size={12.5} color="neg" accessibilityRole="alert" style={{ marginTop: 10 }}>
            {!payout.success ? (payout.error.issues[0]?.message ?? 'Enter your bank details.') : 'Accept the agreement and authorise the collateral lock to continue.'}
          </T>
        ) : null}
        <Button label="Submit application" size={48} loading={apply.isPending} onPress={submit} style={{ marginTop: 16 }} />
      </Sheet>
    </Screen>
  );
};
