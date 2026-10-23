import { asset as assetSpec, formatAmount, isAssetId, parseUnits } from '@xrp/ledger';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AssetSelect, type PickableAsset } from '@/components/AssetPicker';
import { Badge } from '@/components/Badge';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CopyButton } from '@/components/CopyButton';
import { ErrorText, Field, Help, Label, TextField } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { KV } from '@/components/KV';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { T } from '@/components/T';
import { Timeline, type TimelineStep } from '@/components/Timeline';
import { useToast } from '@/components/Toast';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useActivity, useApiMutation, useAssets, useDepositInfo, useProfile } from '@/data/hooks';
import { hm, isSameDay, md } from '@/lib/dates';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useNoScreenCapture } from '@/lib/useNoScreenCapture';
import { useTheme } from '@/theme';

const AUTO_STEPS = [
  { label: 'Detected on ledger', note: 'Transaction seen by deposit monitoring' },
  { label: 'Validated', note: 'Included in a validated ledger, tag matched to your account' },
  { label: 'Compliance screening', note: 'Automated checks; some deposits go to manual review' },
  { label: 'Credited', note: 'Added to your available balance with a receipt' },
];
const AUTO_STAGE: Record<string, number> = { detected: 1, validated: 2, screening_hold: 2, screened: 3, credited: 4 };
const REPORTED_STEPS = (network: string) => [
  { label: 'Reported', note: 'You told us the transaction hash' },
  { label: `Confirmed on ${network}`, note: 'Our team checks the amount and that it reached the platform address' },
  { label: 'Compliance screening', note: 'Source checks before crediting' },
  { label: 'Credited', note: 'Added to your available balance with a receipt' },
];
const REPORTED_STAGE: Record<string, number> = { reported: 1, validated: 2, screened: 3, credited: 4 };

export const DepositScreen = () => {
  useNoScreenCapture('deposit');
  const router = useRouter();
  const { c } = useTheme();
  const showToast = useToast((s) => s.show);
  const params = useLocalSearchParams<{ asset?: string }>();
  const [assetId, setAssetId] = useState<string>(params.asset && isAssetId(params.asset) ? params.asset : 'XRP');
  const assets = useAssets();
  const info = useDepositInfo(assetId);
  const profile = useProfile();
  const activity = useActivity();
  const report = useApiMutation(api.reportDeposit);
  const [copied, setCopied] = useState<'addr' | 'tag' | null>(null);
  const [amount, setAmount] = useState('');
  const [hash, setHash] = useState('');
  const [from, setFrom] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const idem = useRef(newIdempotencyKey());
  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  useEffect(() => {
    setAmount('');
    setHash('');
    setFrom('');
    setTried(false);
    setError('');
  }, [assetId]);

  const spec = assetSpec(assetId);
  const reported = spec.deposit === 'reported';
  const verified = profile.data?.kycStatus === 'verified';
  const options: PickableAsset[] = (assets.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    network: a.network,
    ...(a.depositOpen ? {} : { note: 'Deposits not open yet', disabled: true }),
  }));
  const open = assets.data?.find((a) => a.id === assetId)?.depositOpen ?? true;
  const pending = activity.raw.find(
    (t) => t.kind === 'deposit' && t.asset === assetId && !['credited', 'rejected'].includes(t.status as string) && t.customerId === profile.data?.id,
  );
  const stageMap = reported ? REPORTED_STAGE : AUTO_STAGE;
  const stage = pending ? (stageMap[pending.status as string] ?? 1) : 0;
  const steps: TimelineStep[] = (reported ? REPORTED_STEPS(spec.network) : AUTO_STEPS).map((s, i) => ({
    ...s,
    state: i < stage ? 'done' : i === stage ? (stage === 3 ? 'done' : 'now') : '',
  }));

  const copy = (which: 'addr' | 'tag', text: string) => {
    Clipboard.setStringAsync(text).catch(() => undefined);
    setCopied(which);
  };
  const address = info.data?.address ?? '';
  const tag = info.data?.tag ?? info.data?.memo ?? '';
  const min = info.data?.minDrops ?? 0n;

  const units = parseUnits(amount, assetId);
  const amountErr = !tried ? '' : units === null || units === 0n ? 'Enter the amount you sent.' : units < min ? `The minimum deposit is ${formatAmount(min, assetId, { minDecimals: 0, maxDecimals: 8 })}.` : '';
  const hashErr = !tried ? '' : hash.trim().length < 8 ? 'Paste the transaction hash (ID) from your wallet.' : '';

  const submit = async () => {
    setError('');
    if (units === null || units === 0n || units < min || hash.trim().length < 8) {
      setTried(true);
      return;
    }
    try {
      await report.mutateAsync({ idempotencyKey: idem.current, asset: assetId, amountUnits: units, txHash: hash.trim(), from: from.trim() || null });
      idem.current = newIdempotencyKey();
      setAmount('');
      setHash('');
      setFrom('');
      setTried(false);
      showToast('Deposit reported · we’ll credit it once confirmed.', { durationMs: 3200 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t report this deposit.');
    }
  };

  return (
    <Screen>
      <ScrollBody>
        <TopBar title="Deposit" leadingLabel="Back to Home" />
        <Sec top={0}>Asset</Sec>
        <AssetSelect label="Asset to deposit" value={assetId} assets={options} onChange={setAssetId} />

        <Sec top={22}>Network</Sec>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <Icon name="lock" color="text3" />
          <T weight={500} style={{ flex: 1 }}>
            {spec.network}
          </T>
          {reported ? <Badge label="Only this network" tone="warn" /> : <Badge label={info.data?.testnet === false ? 'Mainnet' : 'Testnet'} tone="warn" />}
        </Card>

        <Sec top={22}>Send to</Sec>
        {!verified ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <Banner tone="info" icon="lock">
              Verify your identity to deposit. Your deposit address appears here once you’re verified.
            </Banner>
            <Button as="a" label="Verify your identity" onPress={() => router.push('/verify')} />
          </Card>
        ) : !open || (info.data && !address) ? (
          <Banner tone="info" icon="info">
            {`${spec.name} deposits aren’t open yet. Choose another asset, or check back soon.`}
          </Banner>
        ) : (
          <>
            <Card clip={false} style={{ padding: 16, gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <View
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={`QR code for the ${spec.name} deposit address`}
                  style={{ width: 104, height: 104, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.surface }}
                >
                  {address ? (
                    <QRCode value={assetId === 'XRP' ? `${address}?dt=${tag}` : address} size={96} color={c.text} backgroundColor={c.surface} quietZone={4} ecl="M" />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <T size={12.5} color="text3">{`${spec.name} deposit address`}</T>
                  <T size={13} lh={1.5} mono selectable>
                    {address}
                  </T>
                  <CopyButton
                    label={copied === 'addr' ? 'Copied' : 'Copy address'}
                    font={14}
                    accessibilityLabel="Copy deposit address"
                    icon={<Icon name="copy" size="sm" />}
                    style={{ alignSelf: 'flex-start' }}
                    onPress={() => copy('addr', address)}
                  />
                </View>
              </View>
              {tag ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, backgroundColor: c.sunken }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={12.5} color="text3">
                      {spec.memo === 'tag' ? 'Destination tag · required' : 'Memo · required'}
                    </T>
                    <T size={20} weight={500} mono num ls={0.04} selectable>
                      {tag}
                    </T>
                  </View>
                  <CopyButton
                    label={copied === 'tag' ? 'Copied' : spec.memo === 'tag' ? 'Copy tag' : 'Copy memo'}
                    font={14}
                    accessibilityLabel={spec.memo === 'tag' ? 'Copy destination tag' : 'Copy memo'}
                    onPress={() => copy('tag', tag)}
                  />
                </View>
              ) : null}
            </Card>
            <Banner tone="warn" icon="alert" style={{ marginTop: 12 }}>
              <T size={13} lh={1.45} color="warn">
                {assetId === 'XRP' ? (
                  <>
                    This address is shared. Always include tag{' '}
                    <T size={13} lh={1.45} weight={600} mono color="warn">
                      {tag}
                    </T>
                    , and send native XRP only — issued tokens sent here can’t be credited.
                  </>
                ) : (
                  `Send only ${assetId} on ${spec.network}${tag ? `, with the memo ${tag}` : ''}. Other networks or tokens sent here may be lost.`
                )}
              </T>
            </Banner>
            <Card style={{ marginTop: 12 }}>
              <KV
                baseline={false}
                items={[
                  { k: 'Minimum deposit', v: formatAmount(min, assetId, { minDecimals: 0, maxDecimals: 8 }) },
                  { k: 'Deposit fee', v: 'None' },
                  { k: 'Credited after', v: reported ? 'Our team confirms it on the network' : 'Ledger validation + screening' },
                ]}
              />
            </Card>

            {reported ? (
              <>
                <Sec top={22}>Already sent it?</Sec>
                <Card style={{ padding: 16, gap: 14 }}>
                  <T size={13.5} lh={1.5} color="text2">
                    {`Tell us about the transaction so we can match it to your account. We check it on ${spec.network} and credit it — usually within a few hours.`}
                  </T>
                  {error ? (
                    <Banner tone="error" icon="alert" alert>
                      {error}
                    </Banner>
                  ) : null}
                  <Field>
                    <Label nativeID="dep-amt">Amount sent</Label>
                    <TextField
                      accessibilityLabelledBy="dep-amt"
                      height={48}
                      size={16}
                      num
                      value={amount}
                      onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
                      keyboardType="decimal-pad"
                      invalid={!!amountErr}
                      placeholder="0.00"
                      trailing={
                        <T weight={500} color="text2">
                          {assetId}
                        </T>
                      }
                    />
                    <ErrorText>{amountErr}</ErrorText>
                  </Field>
                  <Field>
                    <Label nativeID="dep-hash">Transaction hash (ID)</Label>
                    <TextField
                      accessibilityLabelledBy="dep-hash"
                      height={48}
                      size={13}
                      value={hash}
                      onChangeText={setHash}
                      invalid={!!hashErr}
                      placeholder="Paste from your wallet’s transaction details"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <ErrorText>{hashErr}</ErrorText>
                  </Field>
                  <Field>
                    <Label nativeID="dep-from" optional>
                      Sent from address
                    </Label>
                    <TextField
                      accessibilityLabelledBy="dep-from"
                      height={48}
                      size={13}
                      value={from}
                      onChangeText={setFrom}
                      placeholder="Helps us find it faster"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Help>Only report a deposit you’ve already sent. It isn’t credited until it’s confirmed on the network.</Help>
                  </Field>
                  <Button label="Report deposit" loading={report.isPending} onPress={submit} />
                </Card>
              </>
            ) : null}
          </>
        )}

        {pending ? (
          <>
            <Sec top={22}>Deposit in progress</Sec>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingHorizontal: 14 }}>
                <View style={{ gap: 1 }}>
                  <T weight={600} num>{`+${formatAmount(pending.amountDrops ?? 0n, assetId)}`}</T>
                  <T size={12} color="text3">
                    {`${reported ? 'Reported' : 'Detected'} ${isSameDay(pending.createdAt, api.now()) ? `today, ${hm(pending.createdAt)}` : `${md(pending.createdAt)}, ${hm(pending.createdAt)}`}`}
                  </T>
                </View>
                <Badge label={reported ? (stage <= 1 ? 'Confirming' : 'Screening') : (['Detected', 'Validating', 'Screening', 'Credited'][stage] ?? 'Validating')} tone="warn" />
              </View>
              <Timeline steps={steps} />
            </Card>
          </>
        ) : null}
        {api.mode === 'demo' ? (
          <T size={11.5} color="text3" align="center" style={{ marginTop: 16, marginHorizontal: 4 }}>
            Prototype address — not valid on any network. Don’t send funds to it.
          </T>
        ) : null}
      </ScrollBody>
    </Screen>
  );
};
