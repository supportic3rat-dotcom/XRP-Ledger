import { formatAmount, formatUnitsPrecise, isXrplAddress, parseUnits, shortAddress, unitsToCents } from '@xrp/ledger';
import { useQuery } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorText, Field, Help, Label, TextField } from '@/components/Form';
import { HeroIcon } from '@/components/Glyph';
import { KV } from '@/components/KV';
import { Screen, ScrollBody } from '@/components/Screen';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { usePrice } from '@/data/hooks';
import { useMoney } from '@/lib/money';
import { unlockKey } from '@/lib/selfCustody';
import { accountState, EXPLORER, parseAddressInput, preparePayment, signPayment, submitAndWait, type PreparedPayment } from '@/lib/xrpl';

type Step = 'form' | 'review' | 'sending' | 'done';

/**
 * Send XRP from a wallet the customer imported with its recovery phrase. The payment is built and signed on this
 * phone (after fingerprint, face or passcode) and sent straight to the XRP Ledger; the platform never sees the key
 * and never touches the funds. Only a validated ledger result counts as sent.
 */
export const SelfCustodySendScreen = () => {
  const router = useRouter();
  const m = useMoney();
  const { address = '' } = useLocalSearchParams<{ address: string }>();
  const wallet = useQuery({ queryKey: ['xrpl', address], queryFn: () => accountState(address), enabled: isXrplAddress(address) });
  const price = usePrice('XRP');
  const [step, setStep] = useState<Step>('form');
  const [to, setTo] = useState('');
  const [tag, setTag] = useState('');
  const [amount, setAmount] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<PreparedPayment | null>(null);
  const [result, setResult] = useState<{ hash: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  const dest = to.trim();
  const drops = parseUnits(amount, 'XRP');
  const tagNum = tag.trim() === '' ? null : Number(tag.trim());
  const errors = {
    to: !isXrplAddress(dest) ? 'Enter a valid XRP Ledger address.' : dest === address ? 'That’s this wallet’s own address.' : '',
    tag: tagNum !== null && (!Number.isInteger(tagNum) || tagNum < 0 || tagNum > 4294967295) ? 'A destination tag is a whole number.' : '',
    amount: drops === null || drops <= 0n ? 'Enter an amount.' : '',
  };
  const valid = !errors.to && !errors.tag && !errors.amount;
  const fiat = (d: bigint) => (price.data ? ` · ≈ ${m.money(unitsToCents(d, price.data.priceMicro, 'XRP'))}` : '');

  const fill = (text: string) => {
    const found = parseAddressInput(text);
    if (!found) return false;
    setTo(found.address);
    if (found.tag !== null) setTag(String(found.tag));
    return true;
  };

  const review = async () => {
    if (!valid || drops === null) {
      setTried(true);
      return;
    }
    setError('');
    try {
      setPrepared(await preparePayment({ from: address, to: dest, amountDrops: drops, destinationTag: tagNum }));
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t prepare this payment.');
    }
  };

  const send = async () => {
    if (!prepared) return;
    setError('');
    setStep('sending');
    try {
      const keys = await unlockKey(address);
      const blob = signPayment(prepared.tx, keys);
      setResult(await submitAndWait(blob, prepared.lastLedger));
      setStep('done');
      void wallet.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The payment didn’t go through.');
      setStep('review');
    }
  };

  return (
    <Screen>
      <ScrollBody>
        <TopBar leading={step === 'done' ? 'close' : 'back'} title="Send from your wallet" onLeading={() => (step === 'review' ? setStep('form') : router.back())} />
        {error ? (
          <Banner tone="error" icon="alert" alert style={{ marginBottom: 14 }}>
            {error}
          </Banner>
        ) : null}

        <Card style={{ marginBottom: 16 }}>
          <KV
            items={[
              { k: 'From', v: shortAddress(address), mono: true, valueSize: 12.5 },
              {
                k: 'Available to send',
                v: wallet.data ? formatAmount(wallet.data.spendableDrops, 'XRP') : wallet.isError ? 'Couldn’t read' : 'Reading…',
                sub: wallet.data ? `${formatUnitsPrecise(wallet.data.reserveDrops, 'XRP')} XRP stays locked as the ledger reserve` : undefined,
              },
            ]}
            baseline={false}
          />
        </Card>

        {step === 'form' ? (
          <View style={{ gap: 16 }}>
            <Field>
              <Label nativeID="sc-to">To address</Label>
              <TextField
                accessibilityLabelledBy="sc-to"
                value={to}
                onChangeText={(v) => (fill(v) ? undefined : setTo(v))}
                invalid={tried && !!errors.to}
                placeholder="r…"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                trailing={
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Paste address"
                      hitSlop={8}
                      onPress={async () => {
                        const { getStringAsync } = await import('expo-clipboard');
                        if (!fill(await getStringAsync().catch(() => ''))) setError('There’s no XRP Ledger address on your clipboard.');
                      }}
                    >
                      <T size={13} weight={600} color="accentText">
                        Paste
                      </T>
                    </Pressable>
                    {Platform.OS !== 'web' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Scan address QR code"
                        hitSlop={8}
                        onPress={async () => {
                          if (!permission?.granted && !(await requestPermission()).granted) return;
                          scanned.current = false;
                          setScanning((x) => !x);
                        }}
                      >
                        <T size={13} weight={600} color="accentText">
                          {scanning ? 'Close' : 'Scan'}
                        </T>
                      </Pressable>
                    ) : null}
                  </View>
                }
              />
              <ErrorText>{tried ? errors.to : ''}</ErrorText>
            </Field>
            {scanning && permission?.granted ? (
              <View style={{ aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
                <CameraView
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => {
                    if (scanned.current || !fill(data)) return;
                    scanned.current = true;
                    setScanning(false);
                  }}
                  style={{ position: 'absolute', inset: 0 }}
                />
              </View>
            ) : null}
            <Field>
              <Label nativeID="sc-tag">Destination tag (if the recipient gave one)</Label>
              <TextField accessibilityLabelledBy="sc-tag" value={tag} onChangeText={(v) => setTag(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" invalid={!!errors.tag} placeholder="Optional" />
              <ErrorText>{errors.tag}</ErrorText>
              <Help>Exchanges need it to credit your account. Sending without it can lose the payment.</Help>
            </Field>
            <Field>
              <Label nativeID="sc-amt">Amount</Label>
              <TextField
                accessibilityLabelledBy="sc-amt"
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                invalid={tried && !!errors.amount}
                placeholder="0"
                num
                trailing={
                  <T weight={500} color="text2">
                    XRP
                  </T>
                }
              />
              <ErrorText>{tried ? errors.amount : drops ? fiat(drops).replace(' · ', '') : ''}</ErrorText>
            </Field>
            <Button label="Review" onPress={() => void review()} />
          </View>
        ) : null}

        {(step === 'review' || step === 'sending') && prepared && drops !== null ? (
          <View style={{ gap: 14 }}>
            <Card>
              <KV
                items={[
                  { k: 'To', v: shortAddress(dest), mono: true, valueSize: 12.5 },
                  ...(tagNum !== null ? [{ k: 'Destination tag', v: String(tagNum), mono: true }] : []),
                  { k: 'Amount', v: `${formatAmount(drops, 'XRP')}${fiat(drops)}` },
                  { k: 'Network fee', v: `${formatUnitsPrecise(prepared.feeDrops, 'XRP')} XRP` },
                  { k: 'Total', v: formatAmount(drops + prepared.feeDrops, 'XRP'), valueSize: 15 },
                ]}
                baseline={false}
              />
            </Card>
            <Banner tone="warn" icon="alert">
              XRP Ledger payments can’t be reversed. Check the address and tag with the recipient before you send.
            </Banner>
            <Button label={step === 'sending' ? 'Sending…' : 'Confirm and send'} loading={step === 'sending'} onPress={() => void send()} />
            <Help align="center">You’ll be asked for your fingerprint, face or passcode. Your key never leaves this phone.</Help>
          </View>
        ) : null}

        {step === 'done' && result && drops !== null ? (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 10, paddingTop: 8 }}>
              <HeroIcon icon="check" tone="ok" size={52} />
              <T size={24} weight={600} ls={-0.02} accessibilityRole="header">
                Sent
              </T>
              <T color="text2">{`${formatAmount(drops, 'XRP')} was validated on the XRP Ledger.`}</T>
            </View>
            <Card>
              <KV
                items={[
                  { k: 'To', v: shortAddress(dest), mono: true, valueSize: 12.5 },
                  { k: 'Transaction', v: `${result.hash.slice(0, 8)}…${result.hash.slice(-6)}`, mono: true, valueSize: 12.5 },
                ]}
                baseline={false}
              />
            </Card>
            <Button label="View on the XRP Ledger explorer" variant="secondary" onPress={() => void Linking.openURL(`${EXPLORER}${result.hash}`)} />
            <Button label="Done" onPress={() => router.back()} />
          </View>
        ) : null}
      </ScrollBody>
    </Screen>
  );
};
