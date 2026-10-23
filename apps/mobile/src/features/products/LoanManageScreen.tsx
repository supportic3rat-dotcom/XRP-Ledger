import {
  asset as assetSpec,
  assetLimits,
  centsToUnits,
  formatAmount,
  formatAssetPrice,
  formatBps,
  formatUsd,
  LIQUIDATION_BPS,
  ltvBps,
  parseUnits,
  parseUsd,
  thresholdPrice,
  unitsToCents,
} from '@xrp/ledger';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Badge, type BadgeTone } from '@/components/Badge';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PillChips } from '@/components/Chips';
import { CheckRow, ErrorText, Help, Radio, TextField } from '@/components/Form';
import { Footer } from '@/components/Footer';
import { KV, type KVItem } from '@/components/KV';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Segmented } from '@/components/Segmented';
import { T } from '@/components/T';
import { Timeline, type TimelineStep } from '@/components/Timeline';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useActivity, useApiMutation, useBalances, useLoan, usePriceMap } from '@/data/hooks';
import { newIdempotencyKey } from '@/lib/idempotency';

type Mode = 'repay' | 'collateral';
type Via = 'bank' | 'sell';
const STEPS: Record<'bank' | 'sell' | 'coll', [string, string][]> = {
  bank: [
    ['Request recorded', 'We’re expecting your transfer'],
    ['Awaiting payment', 'Send with the reference below'],
    ['Payment received', 'Confirmed by [Lending provider]'],
    ['Applied to loan', 'Balance and LTV updated'],
  ],
  sell: [
    ['Request recorded', 'Firm quote requested'],
    ['Selling collateral', 'Reserved at the accepted quote'],
    ['Payment received', 'Confirmed by [Lending provider]'],
    ['Applied to loan', 'Balance and LTV updated'],
  ],
  coll: [
    ['Request recorded', 'Reserved from available'],
    ['Sent to provider', 'Collateral transfer submitted'],
    ['Lock confirmed', 'Confirmed by [Lending provider]'],
    ['LTV updated', 'New liquidation price applies'],
  ],
};
const REPAY_STAGE: Record<string, number> = { recorded: 0, awaiting_payment: 1, selling: 1, received: 2, applied: 4 };
const COLL_STAGE: Record<string, number> = { recorded: 0, sent: 1, lock_confirmed: 2, ltv_updated: 4 };

export const LoanManageScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const loan = useLoan();
  const la = loan.data?.collateralAsset ?? 'XRP';
  const ld = assetSpec(la).decimals;
  const { prices } = usePriceMap();
  const balances = useBalances(la);
  const activity = useActivity();
  const repay = useApiMutation(api.repayLoan);
  const topUp = useApiMutation(api.addCollateral);
  const idem = useRef(newIdempotencyKey());
  const [mode, setMode] = useState<Mode>(params.mode === 'collateral' ? 'collateral' : 'repay');
  const [step, setStep] = useState<'form' | 'review' | 'status'>('form');
  const [amount, setAmount] = useState('');
  const [coll, setColl] = useState('');
  const [via, setVia] = useState<Via>('bank');
  const [tried, setTried] = useState(false);
  const [ack, setAck] = useState(false);
  const [ackTried, setAckTried] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const l = loan.data;
  const p = prices[la] ?? 0n;
  const fmt = (units: bigint) => formatAmount(units, la);
  const minTopUp = assetLimits(la).minProduct;
  const owed = l ? l.principalCents + l.interestCents : 0n;
  const collDrops = l?.collateralDrops ?? 0n;
  const available = balances.data?.available ?? 0n;
  const isRepay = mode === 'repay';

  const a = parseUsd(amount);
  const rOk = a !== null && a > 0n && a <= owed;
  const left = rOk && a !== null ? owed - a : owed;
  const c = parseUnits(coll, la);
  const cOk = c !== null && c >= minTopUp && c <= available;
  const newColl = collDrops + (cOk && c !== null ? c : 0n);
  const repayErr = tried && !rOk ? (a === null || a === 0n ? 'Enter an amount to repay.' : `That’s more than you owe (${formatUsd(owed)}).`) : '';
  const collErr =
    tried && !cOk
      ? c === null || c < minTopUp
        ? `The minimum top-up is ${formatAmount(minTopUp, la, { minDecimals: 0, maxDecimals: 8 })}.`
        : `You only have ${fmt(available)} available.`
      : '';
  const sellDrops = rOk && a !== null ? centsToUnits(a, p, la) : 0n;
  const half = owed / 2n + (owed % 2n);

  const review = isRepay
    ? {
        kicker: 'You’re repaying',
        amount: rOk && a !== null ? formatUsd(a) : '—',
        cta: via === 'bank' ? 'Confirm and get payment details' : 'Confirm and request quote',
        rows: [
          { k: 'Loan', v: l?.ref ?? '' },
          { k: 'Pay with', v: via === 'bank' ? 'Bank transfer' : `Sell ≈ ${fmt(sellDrops)}` },
          { k: 'Left to repay after', v: formatUsd(left) },
          { k: 'LTV after', v: formatBps(ltvBps(left, collDrops, p, ld)) },
          ...(left === 0n ? [{ k: 'Collateral released', v: `${fmt(collDrops)} to available` }] : []),
        ] satisfies KVItem[],
        note:
          via === 'bank'
            ? 'Your loan balance only drops once [Lending provider] confirms your payment.'
            : `You’ll get a firm ${la} price to accept before anything is sold. Selling may have tax consequences.`,
      }
    : {
        kicker: 'You’re adding',
        amount: cOk && c !== null ? fmt(c) : '—',
        cta: `Confirm and lock ${la}`,
        rows: [
          { k: 'From', v: 'Available balance' },
          { k: 'Collateral after', v: fmt(newColl) },
          { k: 'LTV after', v: formatBps(ltvBps(owed, newColl, p, ld)) },
          { k: 'Liquidation price after', v: formatAssetPrice(thresholdPrice(owed, newColl, LIQUIDATION_BPS, ld)) },
        ] satisfies KVItem[],
        note: 'Collateral only counts once the provider confirms the lock. Until then, your current LTV applies.',
      };

  const tx = activity.raw.find((t) => t.id === txId);
  const statusKey = (tx?.status as string | undefined) ?? 'recorded';
  const stage = (isRepay ? REPAY_STAGE : COLL_STAGE)[statusKey] ?? 0;
  const failed = statusKey === 'failed';
  const src = isRepay ? STEPS[via] : STEPS.coll;
  const steps: TimelineStep[] = src.map(([label, note], i) => ({
    label,
    note,
    state: failed ? (i === 0 ? 'done' : '') : i < stage || stage >= 4 ? 'done' : i === stage ? 'now' : '',
  }));
  const statusLabel = failed ? 'Failed' : stage >= 4 ? 'Completed' : (src[stage]?.[0] ?? 'Request recorded');
  const statusTone: BadgeTone = failed ? 'bad' : stage >= 4 ? 'okPos' : 'warn';

  const toReview = () => {
    if (isRepay ? rOk : cOk) {
      setStep('review');
      setTried(false);
    } else setTried(true);
  };
  const confirm = async () => {
    setError('');
    if (!isRepay && !ack) {
      setAckTried(true);
      return;
    }
    if (!l) return;
    try {
      const created = isRepay
        ? await repay.mutateAsync({ idempotencyKey: idem.current, loanId: l.id, amountCents: a ?? 0n, via })
        : await topUp.mutateAsync({ idempotencyKey: idem.current, loanId: l.id, amountDrops: c ?? 0n });
      setTxId(created.id);
      setStep('status');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t record this request.');
    }
  };

  return (
    <Screen>
      <ScrollBody bottom={108}>
        <TopBar
          title={step === 'form' ? 'Manage loan' : step === 'review' ? 'Review' : isRepay ? 'Repayment' : 'Collateral top-up'}
          leadingLabel={step === 'review' ? 'Back' : 'Back to Borrow'}
          onLeading={step === 'review' ? () => setStep('form') : () => router.replace('/borrow')}
        />
        {error ? (
          <Banner tone="error" icon="alert" alert style={{ marginBottom: 12 }}>
            {error}
          </Banner>
        ) : null}

        {step === 'form' ? (
          <>
            <Segmented
              label="Action"
              height={38}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setTried(false);
              }}
              options={[
                { value: 'repay', label: 'Repay' },
                { value: 'collateral', label: 'Add collateral' },
              ]}
              style={{ marginBottom: 16 }}
            />
            <Card>
              <KV
                num
                fixedKeys
                items={[
                  { k: 'Loan', v: l?.ref ?? '', mono: true, valueSize: 12.5 },
                  { k: 'Outstanding', v: formatUsd(owed) },
                  { k: 'Collateral', v: `${fmt(collDrops)} · ${formatUsd(unitsToCents(collDrops, p, la))}` },
                  { k: 'Current LTV', v: formatBps(ltvBps(owed, collDrops, p, ld)) },
                ]}
              />
            </Card>
            {isRepay ? (
              <>
                <Sec top={20}>Amount to repay</Sec>
                <TextField
                  accessibilityLabel="Repayment amount in USD"
                  height={64}
                  size={26}
                  weight={500}
                  num
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  invalid={!!repayErr}
                  leading={
                    <T size={26} weight={500} color="text2">
                      $
                    </T>
                  }
                />
                <View style={{ marginTop: 10 }}>
                  <PillChips
                    variant="loan"
                    chips={[
                      {
                        label: `Interest ${formatUsd(l?.interestCents ?? 0n)}`,
                        onPress: () =>
                          setAmount(
                            formatUsd(l?.interestCents ?? 0n)
                              .slice(1)
                              .replace(/,/g, ''),
                          ),
                      },
                      { label: `Half ${formatUsd(half)}`, onPress: () => setAmount(formatUsd(half).slice(1).replace(/,/g, '')) },
                      { label: `Full ${formatUsd(owed)}`, onPress: () => setAmount(formatUsd(owed).slice(1).replace(/,/g, '')) },
                    ]}
                  />
                </View>
                <ErrorText style={{ marginTop: 8, marginHorizontal: 4 }}>{repayErr}</ErrorText>
                <Sec top={20}>Pay with</Sec>
                <Card>
                  <View accessibilityRole="radiogroup" accessibilityLabel="Payment source">
                    <Row first minHeight={60} accessibilityState={{ checked: via === 'bank' }} onPress={() => setVia('bank')}>
                      <View style={{ flex: 1, gap: 1 }}>
                        <T weight={500}>Bank transfer</T>
                        <Help>From [Bank account •••• 0000] · 1–2 business days</Help>
                      </View>
                      <Radio on={via === 'bank'} />
                    </Row>
                    <Row minHeight={60} accessibilityState={{ checked: via === 'sell' }} onPress={() => setVia('sell')}>
                      <View style={{ flex: 1, gap: 1 }}>
                        <T weight={500}>{`Sell ${la} from available`}</T>
                        <Help>{rOk ? `≈ ${fmt(sellDrops)} at an indicative ${formatAssetPrice(p)}` : 'Firm quote shown before you confirm'}</Help>
                      </View>
                      <Radio on={via === 'sell'} />
                    </Row>
                  </View>
                </Card>
                <Card style={{ marginTop: 12 }}>
                  <KV
                    num
                    fixedKeys
                    items={[
                      { k: 'Left to repay after', v: formatUsd(left) },
                      { k: 'LTV after', v: formatBps(ltvBps(left, collDrops, p, ld)) },
                    ]}
                  />
                </Card>
              </>
            ) : (
              <>
                <Sec top={20}>{`${la} to add`}</Sec>
                <TextField
                  accessibilityLabel={`${la} to add as collateral`}
                  height={64}
                  size={26}
                  weight={500}
                  num
                  value={coll}
                  onChangeText={(v) => setColl(v.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  invalid={!!collErr}
                  trailing={
                    <T weight={500} color="text2">
                      {la}
                    </T>
                  }
                />
                <View style={{ marginTop: 10 }}>
                  <PillChips
                    variant="loan"
                    chips={[
                      { label: '+250', onPress: () => setColl('250') },
                      { label: '+500', onPress: () => setColl('500') },
                      { label: '+1,000', onPress: () => setColl('1000') },
                    ]}
                  />
                </View>
                <Help style={{ marginTop: 8, marginHorizontal: 4 }}>{`Available ${fmt(available)}`}</Help>
                <ErrorText style={{ marginTop: 6, marginHorizontal: 4 }}>{collErr}</ErrorText>
                <Card style={{ marginTop: 14 }}>
                  <KV
                    num
                    fixedKeys
                    items={[
                      { k: 'Collateral after', v: fmt(newColl) },
                      { k: 'LTV after', v: formatBps(ltvBps(owed, newColl, p, ld)) },
                      { k: 'Liquidation price after', v: formatAssetPrice(thresholdPrice(owed, newColl, LIQUIDATION_BPS, ld)) },
                    ]}
                  />
                </Card>
              </>
            )}
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <View style={{ alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 18 }}>
              <T size={13} color="text3">
                {review.kicker}
              </T>
              <T size={32} weight={500} ls={-0.02} num>
                {review.amount}
              </T>
            </View>
            <Card>
              <KV num fixedKeys items={review.rows} />
            </Card>
            {!isRepay ? (
              <>
                <CheckRow checked={ack} onChange={setAck} style={{ marginTop: 16 }}>
                  {`I understand this ${la} will be locked and can be sold by [Lending provider] if my LTV reaches 80%.`}
                </CheckRow>
                {ackTried && !ack ? <ErrorText style={{ marginTop: 6, marginLeft: 30 }}>Confirm you understand to continue.</ErrorText> : null}
              </>
            ) : null}
            <Banner tone="info" icon="info" style={{ marginTop: 14 }}>
              {review.note}
            </Banner>
          </>
        ) : null}

        {step === 'status' ? (
          <>
            <View style={{ alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 18 }}>
              <T size={28} weight={500} num>
                {review.amount}
              </T>
              <Badge label={statusLabel} tone={statusTone} size="lg" />
              <T size={12} mono color="text3">
                {tx?.ref ?? ''}
              </T>
            </View>
            {isRepay && via === 'bank' && stage <= 1 ? (
              <Card style={{ marginBottom: 12 }}>
                <KV
                  num
                  fixedKeys
                  items={[
                    { k: 'Send to', v: '[Lending provider bank details]' },
                    { k: 'Amount', v: review.amount },
                    {
                      k: 'Payment reference',
                      v:
                        tx?.meta.payment_reference ??
                        `${(l?.ref ?? '').replace('-PROTO-', '').replace(/^LN0*/, 'LN000')}-R${tx?.ref.match(/R(\d+)$/)?.[1] ?? '1'}`,
                      mono: true,
                      valueSize: 12.5,
                    },
                  ]}
                />
              </Card>
            ) : null}
            <Card>
              <Timeline steps={steps} />
            </Card>
            <Banner tone="info" icon="info" style={{ marginTop: 12 }}>
              {isRepay
                ? 'Nothing is charged until you pay or accept a quote. Your loan balance changes only when [Lending provider] confirms.'
                : `No ${la} moves into collateral until the provider confirms the lock. Your current LTV applies until then.`}
            </Banner>
            {isRepay && left === 0n && stage >= 4 ? (
              <Banner tone="info" icon="check" style={{ marginTop: 12 }}>
                {`${fmt(collDrops || 0n)} released to available.`}
              </Banner>
            ) : null}
          </>
        ) : null}
      </ScrollBody>
      <Footer>
        {step === 'form' ? <Button label="Review" flex={1} onPress={toReview} /> : null}
        {step === 'review' ? <Button label={review.cta} flex={1} loading={repay.isPending || topUp.isPending} onPress={confirm} /> : null}
        {step === 'status' ? <Button as="a" label="Done" flex={1} onPress={() => router.replace('/borrow')} /> : null}
      </Footer>
    </Screen>
  );
};
