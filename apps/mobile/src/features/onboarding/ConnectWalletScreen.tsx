import { isXrplAddress, formatXrpUnit, shortAddress } from '@xrp/ledger';
import type { IconName } from '@xrp/tokens';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorText, Field, Help, Label, TextField } from '@/components/Form';
import { HeroIcon } from '@/components/Glyph';
import { Icon } from '@/components/Icon';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Select } from '@/components/Select';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useApiMutation, useExternalWallets } from '@/data/hooks';
import { connectWalletApp, type WalletAppVia } from '@/lib/walletApp';
import { importFromPhrase, isKnownWord, isValidPhrase } from '@/lib/selfCustody';
import { familyFor, useTheme } from '@/theme';

type Method = 'app' | 'addr' | 'phrase';
type Step = 'choose' | 'wait' | 'done';
type Via = WalletAppVia | 'phrase';

const WAIT: Record<Via, [string, string]> = {
  mobile: ['Approve in your wallet', 'We opened your wallet app. Check the request and tap Approve.'],
  qr: ['Approve in your wallet', 'Scan the code with your wallet app, then approve the request there.'],
  hw: ['Approve in your wallet', 'Open the companion app for your hardware wallet and confirm on the device.'],
  phrase: ['Importing your wallet', 'Deriving your XRP Ledger address on this device. Nothing leaves your phone.'],
};

const OPTIONS: { via: WalletAppVia; icon: IconName; title: string; hint: string }[] = [
  { via: 'mobile', icon: 'phone', title: 'XRPL wallet on this phone', hint: 'Opens the app to approve' },
  { via: 'qr', icon: 'qr', title: 'Wallet on another device', hint: 'Scan a QR code to approve' },
  { via: 'hw', icon: 'hardware', title: 'Hardware wallet', hint: 'Through its companion app' },
];

/** Where each wallet keeps its phrase. All use the standard XRP path m/44'/144'/0'/0/0 except Xaman. */
const SOURCES: { value: string; label: string; where: string; supported: boolean }[] = [
  { value: 'trust', label: 'Trust Wallet', where: 'Settings → Wallets → ⋮ next to the wallet → Manual backup.', supported: true },
  { value: 'exodus', label: 'Exodus', where: 'Settings → Security → Secret Recovery Phrase.', supported: true },
  { value: 'ledger', label: 'Ledger', where: 'The recovery sheet you wrote down when you set up the device.', supported: true },
  { value: 'atomic', label: 'Atomic Wallet', where: 'Settings → Private keys → Backup phrase.', supported: true },
  { value: 'xaman', label: 'Xaman (formerly Xumm)', where: 'Xaman uses Secret Numbers, not a word phrase. Connect it with Wallet app or Address instead.', supported: false },
  { value: 'other', label: 'Another wallet (12 or 24 words)', where: 'Any wallet that uses a standard BIP39 phrase for XRP.', supported: true },
];

const Tick = ({ children, color = 'text2' as const, iconColor }: { children: string; color?: 'text2'; iconColor?: 'pos' | 'text2' }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Icon name="check" size="sm" color={iconColor ?? color} />
    <T size={13} color={color} style={{ flex: 1 }}>
      {children}
    </T>
  </View>
);

/** One recovery-phrase slot: `.word` (40 tall, 10 radius) with its number. The word never leaves this component tree. */
const WordSlot = ({
  n,
  value,
  show,
  onChange,
  inputRef,
  onSubmit,
}: {
  n: number;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  inputRef: (r: ComponentRef<typeof TextInput> | null) => void;
  onSubmit: () => void;
}) => {
  const { c } = useTheme();
  const bad = value.length > 0 && !isKnownWord(value);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 40,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: bad ? c.neg : c.border,
        borderRadius: 10,
        backgroundColor: c.surface,
        minWidth: 0,
      }}
    >
      <T size={11} color="text3" num align="right" style={{ width: 16 }}>
        {n}
      </T>
      <TextInput
        ref={inputRef}
        accessibilityLabel={`Word ${n}`}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^a-zA-Z]/g, '').toLowerCase())}
        onSubmitEditing={onSubmit}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        importantForAutofill="no"
        contextMenuHidden
        textContentType="none"
        returnKeyType="next"
        placeholder="word"
        placeholderTextColor={c.text3}
        style={[{ flex: 1, minWidth: 0, padding: 0, fontSize: 13, fontFamily: familyFor(400, true), color: c.text }, { outlineStyle: 'none' } as object]}
      />
    </View>
  );
};

export const ConnectWalletScreen = () => {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('app');
  const [step, setStep] = useState<Step>('choose');
  const [via, setVia] = useState<Via>('mobile');
  const [addr, setAddr] = useState('');
  const [tried, setTried] = useState(false);
  const [connected, setConnected] = useState<{ address: string; kind: 'watch' | 'import' } | null>(null);
  const [len, setLen] = useState<12 | 24>(12);
  const [words, setWords] = useState<string[]>(() => Array(24).fill(''));
  const [show, setShow] = useState(false);
  const [source, setSource] = useState('trust');
  const [error, setError] = useState('');
  const refs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const cancelled = useRef(false);
  const wallets = useExternalWallets();
  const addWatch = useApiMutation(api.addWatchWallet);
  const addSelf = useApiMutation(api.addSelfCustodyWallet);
  const remove = useApiMutation(api.removeExternalWallet);

  // Wipe the phrase from memory when leaving the screen.
  useEffect(() => () => setWords(Array(24).fill('')), []);

  const a = addr.trim();
  const addrOk = isXrplAddress(a);
  const addrErr = tried && !addrOk ? (a ? 'That isn’t a valid XRP Ledger address.' : 'Enter a public address.') : '';
  const slots = words.slice(0, len);
  const anyWord = slots.some(Boolean);
  const src = SOURCES.find((x) => x.value === source) ?? SOURCES[SOURCES.length - 1]!;
  const phraseOk = src.supported && isValidPhrase(slots);

  const pickApp = async (v: WalletAppVia) => {
    setVia(v);
    setStep('wait');
    setError('');
    cancelled.current = false;
    try {
      const r = await connectWalletApp(v);
      if (cancelled.current) return;
      await addWatch.mutateAsync(r.address);
      setConnected({ address: r.address, kind: 'watch' });
      setStep('done');
    } catch (e) {
      if (!cancelled.current) {
        setError(e instanceof Error ? e.message : 'The wallet didn’t approve the connection.');
        setStep('choose');
      }
    }
  };

  const watch = async () => {
    if (!addrOk) {
      setTried(true);
      return;
    }
    await addWatch.mutateAsync(a);
    setConnected({ address: a, kind: 'watch' });
    setStep('done');
  };

  const importWallet = async () => {
    if (!phraseOk) return;
    setVia('phrase');
    setStep('wait');
    setError('');
    try {
      const account = await importFromPhrase(slots);
      setWords(Array(24).fill(''));
      setShow(false);
      await addSelf.mutateAsync(account.address);
      setConnected({ address: account.address, kind: 'import' });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setStep('choose');
    }
  };

  const disconnect = async () => {
    if (connected) await remove.mutateAsync(connected.address);
    setConnected(null);
    setAddr('');
    setTried(false);
    setStep('choose');
  };

  const imported = connected?.kind === 'import';

  return (
    <Screen>
      <ScrollBody>
        <TopBar leading="back" label="Optional" onLeading={() => (step === 'choose' ? router.back() : setStep('choose'))} />

        {step === 'choose' ? (
          <>
            <T size={24} weight={600} ls={-0.02} style={{ marginBottom: 6 }} accessibilityRole="header">
              Connect a wallet you already own
            </T>
            <T lh={1.5} color="text2" style={{ marginBottom: 16 }}>
              Link it to see its balance, or import it with its recovery phrase to use it from this app. It stays separate from your custodial account.
            </T>
            <Segmented
              label="Connection method"
              height={38}
              value={method}
              onChange={setMethod}
              options={[
                { value: 'app', label: 'Wallet app' },
                { value: 'addr', label: 'Address' },
                { value: 'phrase', label: 'Recovery phrase' },
              ]}
              style={{ marginBottom: 16 }}
            />
            {error ? (
              <Banner tone="error" icon="alert" alert style={{ marginBottom: 14 }}>
                {error}
              </Banner>
            ) : null}

            {method === 'app' ? (
              <>
                <Card>
                  {OPTIONS.map((o, i) => (
                    <Row key={o.via} first={i === 0} minHeight={60} onPress={() => pickApp(o.via)} accessibilityLabel={`${o.title}. ${o.hint}`} chevron>
                      <OptIcon icon={o.icon} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <T weight={500}>{o.title}</T>
                        <Help>{o.hint}</Help>
                      </View>
                    </Row>
                  ))}
                </Card>
                <Help style={{ marginTop: 10, marginHorizontal: 4 }}>
                  Only your public address is shared. Supported wallets are listed after compatibility testing.
                </Help>
              </>
            ) : null}

            {method === 'addr' ? (
              <>
                <Field>
                  <Label nativeID="cw-addr">Public XRP Ledger address</Label>
                  <TextField
                    accessibilityLabelledBy="cw-addr"
                    value={addr}
                    onChangeText={setAddr}
                    invalid={!!addrErr}
                    size={14}
                    placeholder="r…"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <ErrorText>{addrErr}</ErrorText>
                  <Help>Starts with “r”, 25–35 characters. Safe to share — it’s the address people send XRP to.</Help>
                </Field>
                <Button label="Add as watch-only" onPress={watch} loading={addWatch.isPending} style={{ marginTop: 16 }} />
              </>
            ) : null}

            {method === 'phrase' ? (
              <>
                <Banner tone="warn" icon="shield" style={{ marginBottom: 14 }}>
                  Your phrase is encrypted and stays on this phone. It’s never sent to us, and our staff will never ask for it — anyone who does is trying to
                  steal your funds.
                </Banner>
                <Field>
                  <Label nativeID="cw-src">Wallet it’s from</Label>
                  <Select label="Wallet it’s from" value={source} options={SOURCES} onChange={setSource} height={48} />
                  <Help>{src.where}</Help>
                </Field>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, marginBottom: 10 }}>
                  <T size={13} weight={500} nativeID="ph-len">
                    Phrase length
                  </T>
                  <Segmented
                    label="Phrase length"
                    height={32}
                    value={String(len)}
                    onChange={(v) => setLen(v === '24' ? 24 : 12)}
                    options={[
                      { value: '12', label: '12 words' },
                      { value: '24', label: '24 words' },
                    ]}
                    style={{ width: 150 }}
                  />
                </View>
                <View accessibilityRole="list" accessibilityLabel="Recovery phrase words" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {slots.map((w, i) => (
                    <View key={i} style={{ width: '31.5%', flexGrow: 1 }}>
                      <WordSlot
                        n={i + 1}
                        value={w}
                        show={show}
                        inputRef={(r) => {
                          refs.current[i] = r;
                        }}
                        onSubmit={() => refs.current[i + 1]?.focus()}
                        onChange={(v) => {
                          // A pasted full phrase fills every slot.
                          const parts = v.split(/\s+/).filter(Boolean);
                          setWords((prev) => {
                            const next = [...prev];
                            if (parts.length > 1) parts.slice(0, len - i).forEach((p, k) => (next[i + k] = p.toLowerCase()));
                            else next[i] = v;
                            return next;
                          });
                        }}
                      />
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Button
                    label="Clear"
                    variant="secondary"
                    size={40}
                    flex={1}
                    disabled={!anyWord}
                    icon={<Icon name="close" size="sm" />}
                    onPress={() => setWords(Array(24).fill(''))}
                  />
                  <Button
                    label={show ? 'Hide' : 'Show'}
                    variant="secondary"
                    size={40}
                    flex={1}
                    disabled={!anyWord}
                    icon={<Icon name="eye" size="sm" />}
                    onPress={() => setShow((s) => !s)}
                  />
                </View>
                {phraseOk ? (
                  <View style={{ marginTop: 12 }}>
                    <Tick iconColor="pos">All words recognised · checksum valid</Tick>
                  </View>
                ) : null}
                <Card style={{ marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 8 }}>
                  <T size={12.5} weight={600} color="text2">
                    Before you import
                  </T>
                  <Tick>Nobody can see your screen</Tick>
                  <Tick>You’re not sharing your screen or on a call</Tick>
                  <Tick>You keep your own paper backup — we can’t restore it</Tick>
                </Card>
                <Button label="Import wallet" onPress={importWallet} disabled={!phraseOk} style={{ marginTop: 16 }} />
              </>
            ) : null}
          </>
        ) : null}

        {step === 'wait' ? (
          <>
            <View style={{ alignItems: 'center', gap: 14, paddingTop: 72, paddingHorizontal: 8, paddingBottom: 24 }}>
              <Spinner />
              <T size={20} weight={600} align="center" accessibilityRole="header">
                {WAIT[via][0]}
              </T>
              <T lh={1.5} color="text2" align="center">
                {WAIT[via][1]}
              </T>
              {via !== 'phrase' ? (
                <Card style={{ alignSelf: 'stretch', marginTop: 8 }}>
                  <KV
                    items={[
                      { k: 'Requested by', v: 'XRP Ledger app' },
                      { k: 'Shares', v: 'Public address only' },
                      { k: 'Can move funds', v: 'No' },
                    ]}
                    baseline={false}
                  />
                </Card>
              ) : null}
            </View>
            {via !== 'phrase' ? (
              <View style={{ gap: 10 }}>
                <Button label="Open wallet app again" onPress={() => pickApp(via)} />
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    cancelled.current = true;
                    setStep('choose');
                  }}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {step === 'done' && connected ? (
          <>
            <View style={{ gap: 10, paddingTop: 12 }}>
              <HeroIcon icon="check" tone="ok" size={52} />
              <T size={24} weight={600} ls={-0.02} accessibilityRole="header">
                {imported ? 'Wallet imported' : 'Wallet connected'}
              </T>
              <T color="text2">
                {imported
                  ? 'Your wallet is ready on this device. You can view it and sign transactions from here.'
                  : method === 'addr'
                    ? 'Added as watch-only. We’ll read its balance from the public ledger.'
                    : 'Your wallet approved the connection and shared its public address.'}
              </T>
            </View>
            <Card style={{ marginTop: 18 }}>
              <KV
                items={[
                  { k: 'Address', v: shortAddress(connected.address), mono: true, valueSize: 12.5 },
                  { k: 'Balance on ledger', v: formatXrpUnit(wallets.data?.find((x) => x.address === connected.address)?.balanceDrops ?? 0n) },
                  ...(imported ? [{ k: 'Imported from', v: src.label }] : []),
                  { k: 'Access', v: imported ? 'Self-custody · keys on this phone' : 'Watch-only' },
                  { k: 'Held in custody', v: 'No' },
                ]}
                baseline={false}
              />
            </Card>
            <Banner tone="info" icon="info" style={{ marginTop: 12 }}>
              {imported
                ? 'You control this wallet. If you lose this phone and your paper backup, we can’t recover it. It’s never counted in your custodial balance.'
                : 'To deposit, earn or borrow you’ll also need a custodial account. This wallet stays separate and is never counted in your custodial balance.'}
            </Banner>
            <View style={{ gap: 10, marginTop: 20 }}>
              <Button as="a" label="Continue to custodial account" onPress={() => router.replace('/create-account')} />
              <Button label={imported ? 'Remove from this device' : 'Disconnect'} variant="secondary" onPress={disconnect} />
            </View>
          </>
        ) : null}
      </ScrollBody>
    </Screen>
  );
};

/** `.opt-ic` — 38×38, 10 radius, sunken, text-2 icon. */
const OptIcon = ({ icon }: { icon: IconName }) => {
  const { c } = useTheme();
  return (
    <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} color="text2" />
    </View>
  );
};

/** `.spin` — 36px ring, accent top; static with reduced motion (ActivityIndicator respects the OS setting). */
const Spinner = () => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ActivityIndicator size="large" color={c.accent} />
    </Pressable>
  );
};
