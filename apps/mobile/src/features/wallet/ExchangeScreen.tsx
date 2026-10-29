import { assetLimits, exchangeEstimateFor, formatAmount, formatAssetPrice, formatUnits, formatUsd, isAssetId, parseUnits, swapEstimate } from '@xrp/ledger';
import { bankPayout } from '@xrp/schemas';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Badge, type BadgeTone } from '@/components/Badge';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { AssetList, UsdOption } from '@/components/AssetPicker';
import { Card } from '@/components/Card';
import { CoinLogo } from '@/components/CoinLogo';
import { Grab, Sheet } from '@/components/Sheet';
import { ErrorText, Field, Label, TextField } from '@/components/Form';
import { Footer } from '@/components/Footer';
import { Icon } from '@/components/Icon';
import { KV } from '@/components/KV';
import { Screen, ScrollBody } from '@/components/Screen';
import { T } from '@/components/T';
import { Timeline, type TimelineStep } from '@/components/Timeline';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useActivity, useApiMutation, useAssets, useBalances, usePriceMap, useQuote } from '@/data/hooks';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useMoney } from '@/lib/money';
import { familyFor, useTheme } from '@/theme';

const STEPS = [
  { label: 'Submitted', note: 'Request recorded' },
  { label: 'Under review', note: 'Eligibility and limit checks' },
  { label: 'Awaiting your acceptance', note: 'Firm quote, valid 60 seconds' },
  { label: 'Approved', note: 'Reserved at the accepted rate' },
  { label: 'Processing', note: 'Our team is completing the payment' },
  { label: 'Completed', note: 'Both legs settled, receipt issued' },
];
const STAGE: Record<string, number> = { requested: 1, quote_requested: 1, quoted: 2, quote_expired: 2, accepted: 3, sold: 4, paid_out: 5 };
const LABELS: Record<number, [string, BadgeTone]> = {
  1: ['Under review', 'warn'],
  2: ['Awaiting user action', 'warn'],
  3: ['Approved', 'ok'],
  4: ['Processing', 'warn'],
  5: ['Completed', 'ok'],
};

/** `.asset` — 40 tall pill with the coin's logo; tappable to change the asset. */
const AssetPill = ({ asset, onPress, label }: { asset: string; onPress: () => void; label: string }) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 40,
        paddingLeft: 6,
        paddingRight: 10,
        borderRadius: 20,
        backgroundColor: pressed ? c.border : c.sunken,
      })}
    >
      <CoinLogo asset={asset} size={28} />
      <T weight={600}>{asset}</T>
      <Icon name="chevronDown" size="xs" color="text3" />
    </Pressable>
  );
};

export const ExchangeScreen = () => {
  const router = useRouter();
  const m = useMoney();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ asset?: string }>();
  const [from, setFrom] = useState<string>(params.asset && isAssetId(params.asset) ? params.asset : 'XRP');
  const [to, setTo] = useState<string>('USD');
  // A USD sale is paid by bank transfer, so it needs the account to pay.
  const [bank, setBank] = useState({ bank: '', accountNumber: '', accountName: '' });
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const assets = useAssets();
  const balances = useBalances(from);
  const { prices } = usePriceMap();
  const activity = useActivity();
  const [amount, setAmount] = useState(from === 'XRP' ? '500' : '');
  const [tried, setTried] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(() => api.now().getTime());
  const idem = useRef(newIdempotencyKey());
  const request = useApiMutation(api.requestExchange);
  const accept = useApiMutation(({ id, quoteId }: { id: string; quoteId: string }) => api.acceptQuote(id, quoteId));
  const requote = useApiMutation(api.requestNewQuote);
  const cancel = useApiMutation(api.cancelExchange);
  const quote = useQuote(txId);

  const lim = assetLimits(from);
  const available = balances.data?.available ?? 0n;
  const p = prices[from] ?? 0n;
  const amt = parseUnits(amount, from);
  const ok = amt !== null && amt >= lim.minProduct && amt <= available;
  const swap = to !== 'USD';
  const est = exchangeEstimateFor(from, amt ?? 0n, p);
  const sw = swap ? swapEstimate(amt ?? 0n, { asset: from, price: p }, { asset: to, price: prices[to] ?? 1n }) : null;
  const payout = bankPayout.safeParse(bank);
  const payoutErr = tried && !swap && !payout.success ? (payout.error.issues[0]?.message ?? 'Enter your bank details.') : '';
  const err =
    tried && !ok
      ? amt === null || amt === 0n
        ? 'Enter an amount.'
        : amt < lim.minProduct
          ? `The minimum request is ${formatAmount(lim.minProduct, from, { minDecimals: 0, maxDecimals: 8 })}.`
          : 'That’s more than your available balance.'
      : '';
  const pick = (id: string) => {
    if (picking === 'from') {
      setFrom(id);
      setAmount('');
      setTried(false);
      if (id === to) setTo('USD');
    } else if (picking === 'to') setTo(id);
    setPicking(null);
  };
  const assetOptions = (assets.data ?? []).map((a) => ({ id: a.id, name: a.name, network: a.network }));

  const tx = activity.raw.find((t) => t.id === txId);
  const status = (tx?.status as string | undefined) ?? 'requested';
  const cancelled = status === 'cancelled';
  const rejected = status === 'rejected';
  const stage = STAGE[status] ?? 1;
  const secsLeft = quote.data ? Math.max(0, Math.ceil((Date.parse(quote.data.expiresAt) - nowMs) / 1000)) : 0;
  const expired = status === 'quote_expired' || (status === 'quoted' && quote.data !== null && quote.data !== undefined && secsLeft === 0);
  const showQuote = status === 'quoted' && !expired && !!quote.data;

  useEffect(() => {
    if (status !== 'quoted') return undefined;
    const t = setInterval(() => setNowMs(api.now().getTime()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const [label, tone]: [string, BadgeTone] = cancelled
    ? ['Cancelled', 'neutral']
    : rejected
      ? ['Rejected', 'bad']
      : (LABELS[stage] ?? ['Under review', 'warn']);
  const steps: TimelineStep[] = STEPS.map((s, i) => ({
    ...s,
    state:
      cancelled || rejected
        ? i === 0
          ? 'done'
          : i === 1 && rejected
            ? 'bad'
            : ''
        : i < stage || (i === stage && stage === 5)
          ? 'done'
          : i === stage
            ? 'now'
            : '',
  }));
  const legA: [string, BadgeTone] =
    cancelled || rejected ? ['Not started', 'neutral'] : stage >= 5 ? ['Settled', 'ok'] : stage >= 3 ? ['Reserved', 'warn'] : ['Not started', 'neutral'];
  const legB: [string, BadgeTone] =
    cancelled || rejected
      ? ['Not started', 'neutral']
      : stage >= 5
        ? ['Settled', 'ok']
        : stage >= 3
          ? ['With our team', 'warn']
          : ['Not started', 'neutral'];

  const submit = async () => {
    if (!ok || amt === null || (!swap && !payout.success)) {
      setTried(true);
      return;
    }
    setError('');
    try {
      const created = await request.mutateAsync({ idempotencyKey: idem.current, asset: from, toAsset: swap ? to : null, ...(!swap && payout.success ? { payout: payout.data } : {}), amountDrops: amt });
      setTxId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t submit this request.');
    }
  };

  return (
    <Screen>
      <ScrollBody bottom={108}>
        <TopBar leading="close" title={txId ? 'Request status' : swap ? 'Swap request' : 'Sell request'} onLeading={() => router.replace('/')} />
        {error ? (
          <Banner tone="error" icon="alert" alert style={{ marginBottom: 12 }}>
            {error}
          </Banner>
        ) : null}

        {!txId ? (
          <>
            <Card clip={false}>
              <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 8 }}>
                <T size={12.5} color="text3" nativeID="x-amt">
                  {swap ? 'You swap' : 'You sell'}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TextInput
                    accessibilityLabelledBy="x-amt"
                    value={amount}
                    onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={c.placeholder}
                    selectionColor={c.accent}
                    style={[
                      { flex: 1, minWidth: 0, height: 22, padding: 0, paddingHorizontal: 2, fontSize: 14, fontFamily: familyFor(400), color: c.text },
                      { outlineStyle: 'none' } as object,
                    ]}
                  />
                  <AssetPill asset={from} label={`Asset to sell: ${from}. Change`} onPress={() => setPicking('from')} />
                </View>
                <T size={12.5} color="text3" num>{`Available ${formatAmount(available, from)}`}</T>
              </View>
              <View style={{ height: 1, backgroundColor: c.border }}>
                <View
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: -16,
                    marginLeft: -16,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="arrowDown" size="sm" color="text2" />
                </View>
              </View>
              <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 8 }}>
                <T size={12.5} color="text3">
                  You receive (estimate)
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <T size={28} weight={500} num color="text2" style={{ flex: 1 }} numberOfLines={1} adjustsFontSizeToFit>
                    {sw ? formatUnits(sw.receive > 0n ? sw.receive : 0n, to) : formatUsd(est.receive).replace('$', '')}
                  </T>
                  <AssetPill asset={to} label={`Receive: ${to}. Change`} onPress={() => setPicking('to')} />
                </View>
                <T size={12.5} color="text3">
                  {swap ? `To your ${to} balance` : `To your bank account${m.equivalent(est.receive) ? ` · ${m.equivalent(est.receive)}` : ''}`}
                </T>
              </View>
            </Card>
            <ErrorText style={{ marginTop: 8, marginHorizontal: 4 }}>{err}</ErrorText>
            {!swap ? (
              <>
                <T size={13} weight={600} color="text2" style={{ marginTop: 18, marginHorizontal: 4, marginBottom: 8 }}>
                  Pay to
                </T>
                <Card style={{ padding: 16, gap: 12 }}>
                  <Field>
                    <Label nativeID="x-bank">Bank</Label>
                    <TextField accessibilityLabelledBy="x-bank" value={bank.bank} onChangeText={(v) => setBank((b) => ({ ...b, bank: v }))} placeholder="e.g. Access Bank" height={48} />
                  </Field>
                  <Field>
                    <Label nativeID="x-acct">Account number</Label>
                    <TextField
                      accessibilityLabelledBy="x-acct"
                      value={bank.accountNumber}
                      onChangeText={(v) => setBank((b) => ({ ...b, accountNumber: v }))}
                      keyboardType="number-pad"
                      autoCorrect={false}
                      mono
                      height={48}
                    />
                  </Field>
                  <Field>
                    <Label nativeID="x-name">Account name</Label>
                    <TextField
                      accessibilityLabelledBy="x-name"
                      value={bank.accountName}
                      onChangeText={(v) => setBank((b) => ({ ...b, accountName: v }))}
                      autoComplete="name"
                      height={48}
                    />
                  </Field>
                  <T size={12} lh={1.5} color="text3">
                    The account must be in your name. We pay by bank transfer once you accept the quote.
                  </T>
                </Card>
                <ErrorText style={{ marginTop: 8, marginHorizontal: 4 }}>{payoutErr}</ErrorText>
              </>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginHorizontal: 4, marginBottom: 8 }}>
              <T size={13} weight={600} color="text2">
                Estimate
              </T>
              <Badge label="Indicative · not a quote" tone="warn" />
            </View>
            <Card>
              <KV
                num
                items={[
                  ...(sw
                    ? [
                        { k: 'Indicative rate', v: `1 ${from} ≈ ${formatUnits(swapEstimate(parseUnits('1', from) ?? 0n, { asset: from, price: p }, { asset: to, price: prices[to] ?? 1n }).gross, to, { minDecimals: 2, maxDecimals: 6 })} ${to}` },
                        { k: 'Spread & service fee (1.00%)', v: `≈ ${formatAmount(sw.fee, to)}` },
                        { k: 'Estimated receive', v: `≈ ${formatAmount(sw.receive > 0n ? sw.receive : 0n, to)}` },
                      ]
                    : [
                        { k: 'Indicative rate', v: `1 ${from} ≈ ${formatAssetPrice(p)}` },
                        { k: 'Spread & service fee (1.00%)', v: `≈ ${formatUsd(est.fee)}` },
                        { k: 'Payout fee', v: formatUsd(est.payout) },
                        { k: 'Estimated receive', v: `≈ ${formatUsd(est.receive)}` },
                      ]),
                  { k: 'Processing', v: 'Manual · business hours' },
                ]}
              />
            </Card>
            <Banner tone="info" icon="info" style={{ marginTop: 12 }}>
              {`This isn’t instant. Our team reviews the request and sends you a firm quote to accept. Your ${from} is reserved only after you accept it.`}
            </Banner>
          </>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 6, paddingTop: 4, paddingBottom: 16 }}>
              <T size={26} weight={500} num>{`${amt !== null ? formatUnits(amt, from, { minDecimals: 0, maxDecimals: 8 }) : ''} ${from} → ${to}`}</T>
              <Badge label={label} tone={tone} />
              <T size={12} mono color="text3">
                {tx?.ref ?? ''}
              </T>
            </View>
            {showQuote && quote.data ? (
              <View style={{ borderWidth: 1.5, borderColor: c.accent, borderRadius: 12, backgroundColor: c.surface, overflow: 'hidden', marginBottom: 14 }}>
                <View style={{ height: 3, width: `${(secsLeft / 60) * 100}%`, backgroundColor: c.accent }} />
                <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <T weight={600}>Firm quote ready</T>
                    <T size={13} color="text3" num accessibilityLiveRegion="polite">{`Expires in ${secsLeft}s`}</T>
                  </View>
                  <KV
                    padX={0}
                    padY={0}
                    num
                    items={[
                      { k: 'Rate', v: `1 ${from} = ${formatAssetPrice(quote.data.priceMicro)}` },
                      { k: 'Fees', v: formatUsd(quote.data.feeCents) },
                      {
                        k: 'You receive',
                        v: quote.data.receiveUnits !== undefined ? formatAmount(quote.data.receiveUnits, to) : formatUsd(quote.data.receiveCents),
                        valueSize: 15,
                      },
                    ]}
                  />
                  <Button
                    label="Accept quote"
                    loading={accept.isPending}
                    onPress={() => quote.data && accept.mutate({ id: txId, quoteId: quote.data.quoteId })}
                  />
                </View>
              </View>
            ) : null}
            {expired && !cancelled ? (
              <Banner
                tone="warn"
                icon="clock"
                style={{ marginBottom: 14 }}
                trailing={
                  <Pressable accessibilityRole="button" onPress={() => requote.mutate(txId)}>
                    <T size={13} lh={1.45} weight={600} color="warn" underline>
                      New quote
                    </T>
                  </Pressable>
                }
              >
                The quote expired. Nothing was reserved.
              </Banner>
            ) : null}
            {rejected ? (
              <Banner tone="error" icon="alert" style={{ marginBottom: 14 }}>
                {`Rejected: ${tx?.meta.reason ?? 'see details'}. No ${from} was reserved.`}
              </Banner>
            ) : null}
            <Card>
              <Timeline steps={steps} />
            </Card>
            <T size={13} weight={600} color="text2" style={{ marginTop: 18, marginHorizontal: 4, marginBottom: 8 }}>
              Settlement legs
            </T>
            <Card>
              <KV
                num
                items={[
                  { k: `1 · Debit ${from}`, v: <Badge label={legA[0]} tone={legA[1]} /> },
                  { k: swap ? `2 · Credit ${to}` : '2 · USD bank transfer', v: <Badge label={legB[0]} tone={legB[1]} /> },
                ]}
              />
            </Card>
            <T size={12} lh={1.5} color="text3" style={{ marginTop: 12, marginHorizontal: 4 }}>
              {swap
                ? `Each leg is recorded separately. ${to} is credited when our team completes the swap.`
                : 'Each leg is recorded separately. The USD is marked paid when our team has made the bank transfer.'}
            </T>
          </>
        )}
      </ScrollBody>
      <Footer>
        {!txId ? (
          <Button label="Submit request" flex={1} loading={request.isPending} onPress={submit} />
        ) : (
          <>
            {!cancelled && !rejected && stage <= 2 ? (
              <Button label="Cancel" variant="secondary" flex={1} loading={cancel.isPending} onPress={() => cancel.mutate(txId)} />
            ) : null}
            <Button as="a" label="Done" flex={1} onPress={() => router.replace('/')} />
          </>
        )}
      </Footer>
      <Sheet open={picking !== null} onClose={() => setPicking(null)} maxHeight={0.86} accessibilityLabel={picking === 'from' ? 'Asset to sell' : 'Asset to receive'}>
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 14 }} accessibilityRole="header">
          {picking === 'from' ? 'Sell or swap' : 'Receive'}
        </T>
        {picking === 'to' ? (
          <Card style={{ marginBottom: 12 }}>
            <UsdOption on={to === 'USD'} onPress={() => pick('USD')} />
          </Card>
        ) : null}
        <AssetList
          assets={assetOptions.filter((a) => (picking === 'to' ? a.id !== from : true))}
          value={picking === 'from' ? from : to}
          onPick={pick}
        />
      </Sheet>
    </Screen>
  );
};
