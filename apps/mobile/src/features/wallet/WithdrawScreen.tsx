import {
  asset as assetSpec,
  assetLimits,
  assetNetwork,
  formatAmount,
  formatUnitsPrecise,
  formatUsd,
  isAssetAddress,
  isAssetId,
  isDestinationTag,
  networkFeeEstimate,
  parseUnits,
  shortAddress,
  unitsToCents,
  withdrawalReceiveFor,
} from '@xrp/ledger';
import type { Transaction } from '@xrp/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AssetSelect } from '@/components/AssetPicker';
import { Pressable, View } from 'react-native';
import { Badge } from '@/components/Badge';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow, ErrorText, Field, Help, Label, Radio, TextField } from '@/components/Form';
import { Footer } from '@/components/Footer';
import { HeroIcon } from '@/components/Glyph';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Segmented } from '@/components/Segmented';
import { Screen, ScrollBody } from '@/components/Screen';
import { StepBar } from '@/components/Steps';
import { T } from '@/components/T';
import { Timeline, type TimelineStep } from '@/components/Timeline';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useActivity, useAllowlist, useApiMutation, useAssets, useBalances, usePrice, useProfile } from '@/data/hooks';
import { confirmWithDevice } from '@/lib/deviceAuth';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useTheme } from '@/theme';
import { slopFor } from '@/components/hitSlop';

const LIFE = (auto: boolean, network: string) => [
  { label: 'Submitted', note: 'Request recorded and confirmed on your device' },
  { label: 'Balance reserved', note: 'Amount earmarked so it can’t be spent twice' },
  { label: 'Compliance review', note: 'Address screening and limit checks' },
  { label: 'Approved', note: 'Authorised by operations staff' },
  auto
    ? { label: 'Sent to custody provider', note: 'Signed inside the provider’s security boundary' }
    : { label: 'Sent from platform wallet', note: 'Sent by our team after approval' },
  auto
    ? { label: 'Validated on ledger', note: 'Transaction hash recorded from a validated ledger' }
    : { label: `Confirmed on ${network}`, note: 'Network transaction hash recorded' },
  { label: 'Completed', note: 'Ledger entries finalised and receipt sent' },
];
const STAGE: Record<string, number> = { requested: 2, in_review: 2, approved: 4, submitted: 5, validated: 7 };
const TITLES = { 2: 'Amount', 3: 'Review', 4: 'Confirm', 5: 'Withdrawal request' } as const;

/** `.mini` — 32 tall outline button; as a design `<button>` its label inherits 14/400. */
const Mini = ({
  label,
  onPress,
  danger,
  padX = 10,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  padX?: number;
  accessibilityLabel?: string;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={slopFor(32)}
      style={({ pressed }) => ({
        height: 32,
        paddingHorizontal: padX,
        borderWidth: 1,
        borderColor: c.borderStrong,
        borderRadius: 8,
        backgroundColor: pressed ? c.sunken : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <T color={danger ? 'neg' : 'text'}>{label}</T>
    </Pressable>
  );
};
export { Mini };

export const WithdrawScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ asset?: string }>();
  const [assetId, setAssetId] = useState<string>(params.asset && isAssetId(params.asset) ? params.asset : 'XRP');
  const assets = useAssets();
  const balances = useBalances(assetId);
  const price = usePrice(assetId);
  const profile = useProfile();
  const allowlist = useAllowlist();
  const activity = useActivity();
  const submitMut = useApiMutation(api.requestWithdrawal);
  const cancelMut = useApiMutation(api.cancelWithdrawal);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [tried, setTried] = useState(0);
  const [addr, setAddr] = useState('');
  const [tag, setTag] = useState('');
  const [noTag, setNoTag] = useState(false);
  const [memo, setMemo] = useState('');
  const [networkId, setNetworkId] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const idem = useRef(newIdempotencyKey());

  const spec = assetSpec(assetId);
  /** The network it's sent on: the customer's pick for multi-network coins, else the coin's own. */
  const net = assetNetwork(assetId, networkId);
  const xrp = assetId === 'XRP';
  const lim = assetLimits(assetId);
  const available = balances.data?.available ?? 0n;
  const p = price.data?.priceMicro ?? 0n;
  const allowOn = !!profile.data?.allowlistEnabled;
  const now = api.now().getTime();
  const saved = (allowlist.data ?? []).filter((s) => s.asset === assetId);
  const activeSaved = saved.filter((s) => Date.parse(s.activeFrom) <= now);
  const a = addr.trim();
  const addrOk = isAssetAddress(assetId, a, net.id);
  const allowBlocked = allowOn && addrOk && !activeSaved.some((s) => s.address === a);
  const tagOk = net.memo !== 'tag' || noTag || isDestinationTag(tag);
  const amt = parseUnits(amount, assetId);
  const amtOk = amt !== null && amt >= lim.minWithdrawal && amt <= available;
  const receive = amt !== null ? withdrawalReceiveFor(assetId, amt) : 0n;
  const frozen = !!profile.data?.frozen;
  useEffect(() => {
    setAddr('');
    setTag('');
    setNoTag(false);
    setMemo('');
    setAmount('');
    setTried(0);
    setNetworkId(undefined);
  }, [assetId]);

  const errs = {
    addr:
      tried >= 1 && !addrOk
        ? a
          ? `That isn’t a valid ${net.name} address. ${net.addressHint}`
          : 'Enter the address you’re sending to.'
        : tried >= 1 && allowBlocked
          ? 'Your allowlist is on. Choose a saved address, or add this one in Security — it activates after 24 hours.'
          : '',
    tag:
      tried >= 1 && !tagOk
        ? tag
          ? 'Destination tags are whole numbers up to 10 digits.'
          : 'Enter a destination tag, or confirm the recipient doesn’t use one.'
        : '',
    amt:
      tried >= 2 && !amtOk
        ? amt === null || amt === 0n
          ? 'Enter an amount.'
          : amt < lim.minWithdrawal
            ? `The minimum withdrawal is ${formatAmount(lim.minWithdrawal, assetId, { minDecimals: 0, maxDecimals: 8 })}.`
            : 'That’s more than your available balance.'
        : '',
  };

  const tx = useMemo<Transaction | undefined>(() => activity.raw.find((t) => t.id === txId), [activity.raw, txId]);
  const life = useMemo(() => {
    const status = (tx?.status as string | undefined) ?? 'requested';
    const cancelled = ['cancelled', 'rejected', 'failed'].includes(status);
    const idx = STAGE[status] ?? 2;
    const lifeSteps = LIFE(spec.deposit === 'automatic', net.name);
    const steps: TimelineStep[] = lifeSteps.map((x, i) => ({
      ...x,
      state: cancelled ? (i < 2 ? 'done' : 'skip') : status === 'validated' || i < idx ? 'done' : i === idx ? 'now' : '',
    }));
    const label =
      status === 'validated'
        ? 'Completed'
        : status === 'cancelled'
          ? 'Cancelled'
          : status === 'rejected'
            ? 'Rejected'
            : status === 'failed'
              ? 'Failed'
              : (lifeSteps[idx]?.label ?? 'Submitted');
    const note = cancelled
      ? status === 'cancelled'
        ? 'Request cancelled. The reserved amount went back to your available balance.'
        : 'This withdrawal didn’t go ahead. The reserved amount went back to your available balance.'
      : `Approval isn’t the same as sent. This shows Completed only after the transaction is confirmed on ${net.name}.`;
    return {
      steps,
      label,
      note,
      tone: status === 'validated' ? ('okPos' as const) : cancelled ? ('off' as const) : ('warn' as const),
      canCancel: !cancelled && idx <= 2 && status !== 'approved',
    };
  }, [tx, spec.deposit, net.name]);

  const fiat = amt !== null ? `≈ ${formatUsd(unitsToCents(amt, p, assetId))}` : '≈ $0.00';
  const amountText = amt === null ? '—' : formatAmount(amt, assetId);
  const receiveText = amt === null ? '—' : `${formatUnitsPrecise(receive, assetId)} ${assetId}`;
  const feeRows = [
    { k: 'Network fee', v: xrp ? `≈ ${formatUnitsPrecise(networkFeeEstimate(assetId), assetId)} XRP` : 'Paid by the platform' },
    { k: 'Platform fee', v: formatAmount(lim.withdrawalFee, assetId, { minDecimals: 2, maxDecimals: 8 }) },
    { k: 'Recipient receives', v: receiveText, total: true },
  ];

  const next = async () => {
    setError('');
    if (step === 1) {
      if (addrOk && tagOk && !allowBlocked) setStep(2);
      else setTried((t) => Math.max(t, 1));
      return;
    }
    if (step === 2) {
      if (amtOk) setStep(3);
      else setTried((t) => Math.max(t, 2));
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    if (step === 4) {
      const ok = await confirmWithDevice('Confirm this withdrawal');
      if (!ok) {
        setError('Device confirmation was cancelled.');
        return;
      }
      try {
        const created = await submitMut.mutateAsync({
          idempotencyKey: idem.current,
          asset: assetId,
          memo: net.memo === 'memo' && memo.trim() ? memo.trim() : null,
          amountDrops: amt ?? 0n,
          destination: a,
          destinationTag: net.memo !== 'tag' || noTag ? null : tag,
          network: net.id,
        });
        setTxId(created.id);
        setStep(5);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'We couldn’t submit this withdrawal. Nothing was reserved.');
      }
    }
  };

  return (
    <Screen>
      <ScrollBody bottom={108}>
        <TopBar
          leading={step > 1 && step < 5 ? 'back' : 'close'}
          leadingLabel={step > 1 && step < 5 ? 'Back' : 'Close'}
          onLeading={step > 1 && step < 5 ? () => setStep((s) => (s - 1) as 1 | 2 | 3 | 4) : () => router.replace('/')}
          title={step === 1 ? `Withdraw ${assetId}` : TITLES[step]}
          marginBottom={4}
        />
        {step < 5 ? <StepBar total={4} current={step} style={{ marginBottom: 20 }} /> : null}
        {frozen ? (
          <Banner tone="error" icon="lock" alert style={{ marginBottom: 14 }}>
            Your account is frozen, so withdrawals are blocked. Contact support for details.
          </Banner>
        ) : null}
        {error ? (
          <Banner tone="error" icon="alert" alert style={{ marginBottom: 14 }}>
            {error}
          </Banner>
        ) : null}

        {step === 1 ? (
          <View style={{ gap: 18 }}>
            <Field>
              <Label>Asset and network</Label>
              <AssetSelect
                label="Asset to withdraw"
                value={assetId}
                assets={(assets.data ?? []).map((x) => ({
                  id: x.id,
                  name: x.name,
                  network: assetSpec(x.id)
                    .networks.map((n) => n.name)
                    .join(' · '),
                }))}
                onChange={setAssetId}
              />
              <Help>{`Sent on ${net.name} only. Available ${formatAmount(available, assetId)}.`}</Help>
            </Field>
            {spec.networks.length > 1 ? (
              <Field>
                <Label>Network</Label>
                <Segmented
                  label="Network"
                  value={net.id}
                  onChange={(v) => {
                    setNetworkId(v);
                    setTried(0);
                  }}
                  options={spec.networks.map((n) => ({ value: n.id, label: n.name }))}
                />
                <Help>Choose the network the receiving wallet uses. Sending on the wrong one can lose the funds.</Help>
              </Field>
            ) : null}
            {allowOn ? (
              <Field>
                <Label>Saved addresses</Label>
                <Card>
                  {saved.length === 0 ? (
                    <T size={13.5} color="text3" align="center" style={{ paddingVertical: 18 }}>
                      {`No saved ${assetId} addresses yet.`}
                    </T>
                  ) : null}
                  {saved.map((s, i) => {
                    const active = Date.parse(s.activeFrom) <= now;
                    const on = a === s.address;
                    return (
                      <Row
                        key={s.id}
                        first={i === 0}
                        minHeight={60}
                        accessibilityState={{ checked: on }}
                        onPress={
                          active
                            ? () => {
                                setAddr(s.address);
                                setNetworkId(spec.networks.find((n) => n.address.test(s.address))?.id);
                                setTag(s.tag ?? '');
                                setNoTag(!s.tag);
                                setMemo(s.memo ?? '');
                              }
                            : undefined
                        }
                      >
                        <View style={{ flex: 1, gap: 1, opacity: active ? 1 : 0.5 }}>
                          <T weight={500}>{s.label}</T>
                          <T size={12} mono color="text3">
                            {`${shortAddress(s.address)}${s.tag ? ` · tag ${s.tag}` : ''}`}
                          </T>
                        </View>
                        {active ? <Radio on={on} /> : <Badge label="Activates in 24h" tone="warn" />}
                      </Row>
                    );
                  })}
                </Card>
                <Help>Your allowlist is on, so withdrawals only go to saved addresses. Manage them in Security.</Help>
              </Field>
            ) : null}
            <Field>
              <Label nativeID="w-addr">Destination address</Label>
              <TextField
                accessibilityLabelledBy="w-addr"
                value={addr}
                onChangeText={setAddr}
                invalid={!!errs.addr}
                size={14}
                placeholder={net.addressHint}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                trailing={
                  <Mini
                    label="Paste"
                    accessibilityLabel="Paste address"
                    onPress={async () => {
                      const { getStringAsync } = await import('expo-clipboard');
                      setAddr((await getStringAsync()).trim());
                    }}
                  />
                }
              />
              <ErrorText>{errs.addr}</ErrorText>
            </Field>
            {net.memo === 'tag' ? (
              <Field>
                <Label nativeID="w-tag">Destination tag</Label>
                <TextField
                  accessibilityLabelledBy="w-tag"
                  value={tag}
                  onChangeText={(v) => setTag(v.replace(/\D/g, ''))}
                  invalid={!!errs.tag}
                  editable={!noTag}
                  keyboardType="number-pad"
                  placeholder="Required by most exchanges"
                />
                <ErrorText>{errs.tag}</ErrorText>
                <CheckRow
                  checked={noTag}
                  size={18}
                  onChange={(v) => {
                    setNoTag(v);
                    setTag('');
                  }}
                  style={{ alignItems: 'center', marginTop: 2 }}
                >
                  <T size={13} color="text2">
                    The recipient doesn’t use a destination tag
                  </T>
                </CheckRow>
              </Field>
            ) : null}
            {net.memo === 'memo' ? (
              <Field>
                <Label nativeID="w-memo" optional>
                  Memo
                </Label>
                <TextField
                  accessibilityLabelledBy="w-memo"
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="Required by most exchanges"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Help>Check whether the recipient needs one: sending to an exchange without its memo can lose the funds.</Help>
              </Field>
            ) : null}
            {xrp ? (
              <Banner tone="info" icon="info">
                New XRP Ledger accounts need a minimum reserve before they can receive. Sending less to an unactivated address will fail.
              </Banner>
            ) : (
              <Banner tone="warn" icon="alert">
                {`Double-check the address is for ${net.name}. Sending to an address on another network can lose the funds.`}
              </Banner>
            )}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: 18 }}>
            <Field>
              <Label nativeID="w-amt">Amount</Label>
              <TextField
                accessibilityLabelledBy="w-amt"
                height={64}
                size={26}
                weight={500}
                num
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
                invalid={!!errs.amt}
                keyboardType="decimal-pad"
                placeholder="0.00"
                trailing={
                  <>
                    <T weight={500} color="text2">
                      {assetId}
                    </T>
                    <Mini
                      label="Max"
                      accessibilityLabel="Use maximum available"
                      onPress={() => setAmount(formatUnitsPrecise(available, assetId).replace(/,/g, ''))}
                    />
                  </>
                }
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Help>{fiat}</Help>
                <Help>{`Available ${formatAmount(available, assetId)}`}</Help>
              </View>
              <ErrorText>{errs.amt}</ErrorText>
            </Field>
            <Card>
              <KV num items={feeRows} />
            </Card>
            <Help>Fees are deducted from the amount. Network fee is an estimate and may vary slightly.</Help>
          </View>
        ) : null}

        {step === 3 ? (
          <>
            <View style={{ alignItems: 'center', gap: 2, paddingTop: 4, paddingBottom: 16 }}>
              <T size={13} color="text3">
                You’re withdrawing
              </T>
              <T size={32} weight={500} ls={-0.02} num>
                {amountText}
              </T>
              <T size={13} color="text3" num>
                {fiat}
              </T>
            </View>
            <Card>
              <KV
                num
                items={[
                  { k: 'To', v: a, mono: true, valueSize: 12.5, valueWeight: 400 },
                  ...(net.memo === 'tag' ? [{ k: 'Destination tag', v: noTag ? 'None' : tag, mono: true }] : []),
                  ...(net.memo === 'memo' ? [{ k: 'Memo', v: memo.trim() || 'None', mono: true }] : []),
                  { k: 'Network', v: net.name },
                  ...feeRows,
                ]}
              />
            </Card>
            {amt !== null && amt > lim.approvalThreshold ? (
              <Banner tone="warn" icon="alert" style={{ marginTop: 12 }}>
                {`Over ${formatAmount(lim.approvalThreshold, assetId, { minDecimals: 0, maxDecimals: 8 })}: this withdrawal needs a second reviewer, which can add a few hours.`}
              </Banner>
            ) : null}
            <Banner tone="info" icon="info" style={{ marginTop: 12 }}>
              {`Withdrawals are reviewed before they’re sent. Once confirmed on ${net.name} they can’t be reversed.`}
            </Banner>
          </>
        ) : null}

        {step === 4 ? (
          <View style={{ gap: 12, paddingTop: 12 }}>
            <HeroIcon icon="lock" tone="ok" size={52} />
            <T size={22} weight={600} ls={-0.02} accessibilityRole="header">
              Confirm it’s you
            </T>
            <T color="text2">Submit this withdrawal request with Face ID, your fingerprint or your phone’s passcode.</T>
          </View>
        ) : null}

        {step === 5 ? (
          <>
            <View style={{ alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 18 }}>
              <T size={28} weight={500} num>
                {amountText}
              </T>
              <Badge label={life.label} tone={life.tone} size="lg" />
              <T size={12} mono color="text3">
                {tx?.ref ?? ''}
              </T>
            </View>
            <Card>
              <Timeline steps={life.steps} />
            </Card>
            <Banner tone="info" icon="info" style={{ marginTop: 12 }}>
              {life.note}
            </Banner>
          </>
        ) : null}
      </ScrollBody>
      <Footer>
        {step === 5 ? (
          <>
            {life.canCancel ? (
              <Button label="Cancel request" variant="secondary" flex={1} loading={cancelMut.isPending} onPress={() => txId && cancelMut.mutate(txId)} />
            ) : null}
            <Button as="a" label="Done" flex={1} onPress={() => router.replace('/')} />
          </>
        ) : (
          <Button
            label={step === 3 ? 'Continue to confirm' : step === 4 ? 'Submit withdrawal request' : 'Continue'}
            flex={1}
            onPress={next}
            loading={submitMut.isPending}
            disabled={frozen}
          />
        )}
      </Footer>
    </Screen>
  );
};
