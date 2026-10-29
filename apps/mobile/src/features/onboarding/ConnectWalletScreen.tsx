import { WALLET_NETWORKS, formatAmount, isNetworkAddress, shortAddress, walletNetwork } from '@xrp/ledger';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { IconName } from '@xrp/tokens';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
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
import { useApiMutation } from '@/data/hooks';
import { dropPendingWallet, savePendingWallet } from '@/lib/pendingWallets';
import { areValidSecretNumbers, isValidRow, ROWS } from '@/lib/secretNumbers';
import { importFromPhrase, importFromSecretKey, importFromSecretNumbers, isKnownWord, isValidPhrase, isValidSecretKey, removeSelfCustody } from '@/lib/selfCustody';
import { readWalletAddress } from '@/lib/walletAddress';
import { useSession } from '@/state/session';
import { familyFor, useTheme } from '@/theme';

type Method = 'scan' | 'addr' | 'phrase';
type Step = 'choose' | 'wait' | 'done';

type Format = 'phrase' | 'numbers' | 'seed';
const FORMAT_LABELS: Record<Format, string> = { phrase: 'Recovery phrase (12 or 24 words)', numbers: 'Secret Numbers (8 rows of 6 digits)', seed: 'Secret key (starts with “s”)' };

/**
 * Wallets that hold XRP, and the backup format each shows. Phrase wallets use the standard XRP path m/44'/144'/0'/0/0.
 * "Another wallet" lets the customer type the wallet's name and pick its format.
 */
const SOURCES: { value: string; label: string; where: string; format: Format }[] = [
  { value: 'trust', label: 'Trust Wallet', where: 'Settings → Wallets → ⋮ next to the wallet → Manual backup.', format: 'phrase' },
  { value: 'xaman', label: 'Xaman (formerly Xumm)', where: 'Settings → Accounts → your account → Security → reveal Secret Numbers (rows A–H).', format: 'numbers' },
  { value: 'coinbase', label: 'Coinbase Wallet', where: 'Settings → Security → Show recovery phrase.', format: 'phrase' },
  { value: 'exodus', label: 'Exodus', where: 'Settings → Security → Secret Recovery Phrase.', format: 'phrase' },
  { value: 'ledger', label: 'Ledger', where: 'The recovery sheet you wrote down when you set up the device.', format: 'phrase' },
  { value: 'trezor', label: 'Trezor', where: 'The wallet backup card you wrote down when you set up the device.', format: 'phrase' },
  { value: 'atomic', label: 'Atomic Wallet', where: 'Settings → Private keys → Backup phrase.', format: 'phrase' },
  { value: 'safepal', label: 'SafePal', where: 'Wallet → ⋮ → Manage wallet → Backup mnemonic phrase.', format: 'phrase' },
  { value: 'bitget', label: 'Bitget Wallet', where: 'Me → Wallet management → your wallet → Back up mnemonic phrase.', format: 'phrase' },
  { value: 'okx', label: 'OKX Wallet', where: 'Wallet → Manage wallets → your wallet → Back up seed phrase.', format: 'phrase' },
  { value: 'guarda', label: 'Guarda', where: 'Settings → Wallet → Backup → Show mnemonic.', format: 'phrase' },
  { value: 'coinomi', label: 'Coinomi', where: 'Settings → Recovery phrase.', format: 'phrase' },
  { value: 'edge', label: 'Edge', where: 'Your wallet → ⋮ → Get Seed (or your 2FA backup).', format: 'phrase' },
  { value: 'keystone', label: 'Keystone', where: 'The seed phrase you wrote down when you set up the device.', format: 'phrase' },
  { value: 'ellipal', label: 'Ellipal', where: 'The mnemonic you backed up when you created the wallet.', format: 'phrase' },
  { value: 'crossmark', label: 'Crossmark', where: 'Settings → Accounts → your account → Reveal secret key.', format: 'seed' },
  { value: 'gemwallet', label: 'GemWallet', where: 'Settings → Show secret seed (or your recovery phrase).', format: 'seed' },
  { value: 'xrptoolkit', label: 'XRP Toolkit', where: 'The secret key you saved when you created the account.', format: 'seed' },
  { value: 'other', label: 'Another wallet (type its name)', where: 'Type the wallet’s name below, then choose the kind of backup it gave you.', format: 'phrase' },
];

const NETWORK_OPTIONS = WALLET_NETWORKS.map((n) => ({ value: n.id, label: `${n.name} · ${n.assets.join(', ')}` }));

/** One row of Xaman Secret Numbers (A–H): 6 digits, the last a check digit, so a typo shows at once. */
const SecretRow = ({ i, value, show, onChange }: { i: number; value: string; show: boolean; onChange: (v: string) => void }) => {
  const { c } = useTheme();
  const bad = value.length === 6 && !isValidRow(i, value);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 44,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: bad ? c.neg : c.border,
        borderRadius: 10,
        backgroundColor: c.surface,
      }}
    >
      <T size={12} weight={600} color="text3" style={{ width: 14 }}>
        {String.fromCharCode(65 + i)}
      </T>
      <TextInput
        accessibilityLabel={`Row ${String.fromCharCode(65 + i)}`}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        secureTextEntry={!show}
        autoComplete="off"
        importantForAutofill="no"
        contextMenuHidden
        placeholder="000000"
        placeholderTextColor={c.text3}
        style={[
          { flex: 1, minWidth: 0, padding: 0, fontSize: 15, letterSpacing: 2, fontFamily: familyFor(400, true), color: c.text },
          { outlineStyle: 'none' } as object,
        ]}
      />
      {value.length === 6 ? <Icon name={bad ? 'close' : 'check'} size="sm" color={bad ? 'neg' : 'pos'} /> : null}
    </View>
  );
};

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
  const signedIn = useSession((x) => x.signedIn);
  const [method, setMethod] = useState<Method>('scan');
  const [step, setStep] = useState<Step>('choose');
  const [addr, setAddr] = useState('');
  const [tried, setTried] = useState(false);
  const [connected, setConnected] = useState<{ address: string; kind: 'watch' | 'import'; network: string } | null>(null);
  const [balances, setBalances] = useState<Record<string, bigint> | null>(null);
  const [network, setNetwork] = useState('xrp');
  const [several, setSeveral] = useState(false);
  const [numbers, setNumbers] = useState<string[]>(() => Array(ROWS).fill(''));
  const [len, setLen] = useState<12 | 24>(12);
  const [words, setWords] = useState<string[]>(() => Array(24).fill(''));
  const [show, setShow] = useState(false);
  const [source, setSource] = useState('trust');
  const [otherName, setOtherName] = useState('');
  const [otherFormat, setOtherFormat] = useState<Format>('phrase');
  const [seed, setSeed] = useState('');
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);
  const refs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const addWatch = useApiMutation(({ address, network: n }: { address: string; network: string }) => api.addWatchWallet(address, n));
  const addSelf = useApiMutation(api.addSelfCustodyWallet);
  const remove = useApiMutation(({ address, network: n }: { address: string; network: string }) => api.removeExternalWallet(address, n));

  // Wipe the phrase from memory when leaving the screen.
  useEffect(
    () => () => {
      setWords(Array(24).fill(''));
      setNumbers(Array(ROWS).fill(''));
    },
    [],
  );

  const a = addr.trim();
  const net = walletNetwork(network) ?? WALLET_NETWORKS[0]!;
  const addrOk = isNetworkAddress(network, a);
  const addrErr = tried && !addrOk ? (a ? `That isn’t a valid ${net.name} address.` : 'Enter a public address.') : '';
  const slots = words.slice(0, len);
  const anyWord = slots.some(Boolean);
  const src = SOURCES.find((x) => x.value === source) ?? SOURCES[SOURCES.length - 1]!;
  const other = source === 'other';
  const format: Format = other ? otherFormat : src.format;
  const xaman = format === 'numbers';
  const walletName = other ? otherName.trim() || 'Another wallet' : src.label;
  const phraseOk =
    (!other || otherName.trim().length > 0) &&
    (format === 'numbers' ? areValidSecretNumbers(numbers) : format === 'seed' ? isValidSecretKey(seed) : isValidPhrase(slots));
  const anySecret = format === 'numbers' ? numbers.some(Boolean) : format === 'seed' ? seed.length > 0 : anyWord;

  /** Links the wallet to the account, or keeps it on this phone until sign-up, then reads its balance. */
  const link = async (address: string, kind: 'watch' | 'import') => {
    const access = kind === 'import' ? 'self_custody' : 'watch';
    const on = kind === 'import' ? 'xrp' : network;
    if (signedIn) await (access === 'self_custody' ? addSelf.mutateAsync(address) : addWatch.mutateAsync({ address, network: on }));
    else await savePendingWallet({ address, access, network: on });
    setConnected({ address, kind, network: on });
    setBalances(null);
    setStep('done');
    api
      .walletBalance(on, address)
      .then(setBalances)
      .catch(() => setBalances(null));
  };

  const watch = async (address = a) => {
    if (!isNetworkAddress(network, address)) {
      setTried(true);
      return;
    }
    setError('');
    try {
      await link(address, 'watch');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t link that wallet.');
    }
  };

  /** Fills the address and network from a scan or paste; the customer checks them and taps Add. */
  const fill = (text: string): boolean => {
    const found = readWalletAddress(text);
    if (!found) return false;
    setAddr(found.address);
    if (!found.networks.includes(network)) setNetwork(found.networks.includes('ethereum') ? 'ethereum' : found.networks[0]!);
    setSeveral(found.networks.length > 1);
    setTried(false);
    setError('');
    setMethod('addr');
    return true;
  };

  const onScan = (data: string) => {
    if (scanned.current) return;
    if (!fill(data)) {
      setError('That QR code isn’t a wallet address we support. Scan the Receive code in your wallet.');
      return;
    }
    scanned.current = true;
  };

  const startScan = async () => {
    setError('');
    scanned.current = false;
    if (Platform.OS !== 'web' && !permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) setError('Allow camera access to scan, or paste the address instead.');
    }
  };

  const paste = async () => {
    const { getStringAsync } = await import('expo-clipboard');
    if (!fill(await getStringAsync().catch(() => ''))) setError('There’s no wallet address on your clipboard. Copy it from your wallet first.');
  };

  const importWallet = async () => {
    if (!phraseOk) return;
    setStep('wait');
    setError('');
    try {
      const account =
        format === 'numbers' ? await importFromSecretNumbers(numbers) : format === 'seed' ? await importFromSecretKey(seed) : await importFromPhrase(slots);
      setWords(Array(24).fill(''));
      setNumbers(Array(ROWS).fill(''));
      setSeed('');
      setShow(false);
      await link(account.address, 'import');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setStep('choose');
    }
  };

  const disconnect = async () => {
    if (connected) {
      if (signedIn) await remove.mutateAsync({ address: connected.address, network: connected.network });
      await dropPendingWallet(connected.address);
      if (connected.kind === 'import') await removeSelfCustody(connected.address);
    }
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
                { value: 'scan', label: 'Scan QR' },
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

            {method !== 'phrase' ? (
              <Field style={{ marginBottom: 14 }}>
                <Label nativeID="cw-net">Network</Label>
                <Select
                  label="Network"
                  value={network}
                  options={NETWORK_OPTIONS}
                  onChange={(v) => {
                    setNetwork(v);
                    setSeveral(false);
                  }}
                  height={48}
                />
              </Field>
            ) : null}

            {method === 'scan' ? (
              <>
                <View style={{ aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                  {Platform.OS !== 'web' && permission?.granted ? (
                    <CameraView
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={({ data }) => onScan(data)}
                      style={{ position: 'absolute', inset: 0 }}
                    />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 12, padding: 24 }}>
                      <Icon name="qr" size={32} color="text3" />
                      <Button
                        label={Platform.OS === 'web' ? 'Scanning works in the phone app' : 'Turn on the camera'}
                        size={48}
                        disabled={Platform.OS === 'web'}
                        onPress={startScan}
                      />
                    </View>
                  )}
                </View>
                <Help style={{ marginTop: 10, marginHorizontal: 4 }}>
                  In your other wallet, open Receive and scan its QR code. We fill in the address and network for you to check. Only the public address is read;
                  nothing can be moved from it.
                </Help>
              </>
            ) : null}

            {method === 'addr' ? (
              <>
                <Field>
                  <Label nativeID="cw-addr">{`Public ${net.name} address`}</Label>
                  <TextField
                    accessibilityLabelledBy="cw-addr"
                    value={addr}
                    onChangeText={setAddr}
                    invalid={!!addrErr}
                    size={14}
                    placeholder={net.id === 'xrp' ? 'r…' : 'Wallet address'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                    trailing={
                      <Pressable accessibilityRole="button" accessibilityLabel="Paste address" onPress={() => void paste()} hitSlop={8}>
                        <T size={13} weight={600} color="accentText">
                          Paste
                        </T>
                      </Pressable>
                    }
                  />
                  <ErrorText>{addrErr}</ErrorText>
                  <Help>{`${net.addressHint} Safe to share — it’s the address people send ${net.assets.join(' or ')} to.`}</Help>
                  {several ? (
                    <Banner tone="warn" icon="info" size={12.5} style={{ marginTop: 8 }}>
                      This address works on several networks (Ethereum, BNB Smart Chain, Polygon, Cronos, Flare). Check the network above is the one your wallet
                      uses.
                    </Banner>
                  ) : null}
                </Field>
                <Button label="Add as watch-only" onPress={() => void watch()} loading={addWatch.isPending} style={{ marginTop: 16 }} />
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
                {other ? (
                  <>
                    <Field style={{ marginTop: 12 }}>
                      <Label nativeID="cw-other">Wallet name</Label>
                      <TextField accessibilityLabelledBy="cw-other" value={otherName} onChangeText={setOtherName} placeholder="e.g. My hardware wallet" height={48} />
                    </Field>
                    <Field style={{ marginTop: 12 }}>
                      <Label nativeID="cw-format">Backup it gave you</Label>
                      <Select
                        label="Backup it gave you"
                        value={otherFormat}
                        options={(Object.keys(FORMAT_LABELS) as Format[]).map((f) => ({ value: f, label: FORMAT_LABELS[f] }))}
                        onChange={(v) => setOtherFormat(v as Format)}
                        height={48}
                      />
                    </Field>
                  </>
                ) : null}
                {format === 'seed' ? (
                  <Field style={{ marginTop: 14 }}>
                    <Label nativeID="cw-seed">Secret key</Label>
                    <TextField
                      accessibilityLabelledBy="cw-seed"
                      value={seed}
                      onChangeText={(v) => setSeed(v.trim())}
                      secureTextEntry={!show}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="off"
                      importantForAutofill="no"
                      contextMenuHidden
                      placeholder="s…"
                      mono
                      height={48}
                      invalid={seed.length > 20 && !isValidSecretKey(seed)}
                    />
                    <Help>Starts with “s”, about 29 characters. It stays on this phone.</Help>
                  </Field>
                ) : null}
                {xaman ? (
                  <View accessibilityRole="list" accessibilityLabel="Secret Numbers" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    {numbers.map((v, i) => (
                      <View key={i} style={{ width: '48%', flexGrow: 1 }}>
                        <SecretRow i={i} value={v} show={show} onChange={(x) => setNumbers((prev) => prev.map((p, k) => (k === i ? x : p)))} />
                      </View>
                    ))}
                  </View>
                ) : null}
                {format === 'phrase' ? (
                  <>
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
                  </>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Button
                    label="Clear"
                    variant="secondary"
                    size={40}
                    flex={1}
                    disabled={!anySecret}
                    icon={<Icon name="close" size="sm" />}
                    onPress={() => {
                      setWords(Array(24).fill(''));
                      setNumbers(Array(ROWS).fill(''));
                      setSeed('');
                    }}
                  />
                  <Button
                    label={show ? 'Hide' : 'Show'}
                    variant="secondary"
                    size={40}
                    flex={1}
                    disabled={!anySecret}
                    icon={<Icon name="eye" size="sm" />}
                    onPress={() => setShow((s) => !s)}
                  />
                </View>
                {phraseOk ? (
                  <View style={{ marginTop: 12 }}>
                    <Tick iconColor="pos">{format === 'numbers' ? 'All 8 rows check out' : format === 'seed' ? 'Secret key is valid' : 'All words recognised · checksum valid'}</Tick>
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
          <View style={{ alignItems: 'center', gap: 14, paddingTop: 72, paddingHorizontal: 8, paddingBottom: 24 }}>
            <Spinner />
            <T size={20} weight={600} align="center" accessibilityRole="header">
              Importing your wallet
            </T>
            <T lh={1.5} color="text2" align="center">
              Deriving your XRP Ledger address on this device. Nothing leaves your phone.
            </T>
          </View>
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
                  ? 'Your wallet is ready on this phone. You can see its balance and send XRP from it.'
                  : `Added as watch-only. We read its balance from the public ${walletNetwork(connected.network)?.name ?? ''} network.`}
                {signedIn ? '' : ' It will be linked to your account when you create one or sign in.'}
              </T>
            </View>
            <Card style={{ marginTop: 18 }}>
              <KV
                items={[
                  { k: 'Address', v: shortAddress(connected.address), mono: true, valueSize: 12.5 },
                  { k: 'Network', v: walletNetwork(connected.network)?.name ?? connected.network },
                  ...(walletNetwork(connected.network)?.assets ?? []).map((asset) => ({
                    k: `${asset} balance`,
                    v: balances ? formatAmount(balances[asset] ?? 0n, asset) : 'Reading…',
                  })),
                  ...(imported ? [{ k: 'Imported from', v: walletName }] : []),
                  { k: 'Access', v: imported ? 'Self-custody · keys on this phone' : 'Watch-only' },
                  { k: 'Held in custody', v: 'No' },
                ]}
                baseline={false}
              />
            </Card>
            {imported && xaman ? (
              <Banner tone="warn" icon="shield" style={{ marginTop: 12 }}>
                Check this address matches the one Xaman shows for this account. If it doesn’t, remove it and check the numbers.
              </Banner>
            ) : null}
            <Banner tone="info" icon="info" style={{ marginTop: 12 }}>
              {imported
                ? 'You control this wallet. If you lose this phone and your paper backup, we can’t recover it. It’s never counted in your custodial balance.'
                : 'This wallet stays separate and is never counted in your custodial balance. To deposit, earn or borrow, use your custodial account.'}
            </Banner>
            <View style={{ gap: 10, marginTop: 20 }}>
              {signedIn && imported ? (
                <Button
                  as="a"
                  label="Send XRP from this wallet"
                  onPress={() => router.replace({ pathname: '/wallet-send', params: { address: connected.address } })}
                />
              ) : null}
              <Button
                as="a"
                label={signedIn ? 'Done' : 'Continue to custodial account'}
                variant={signedIn && imported ? 'secondary' : 'primary'}
                onPress={() => router.replace(signedIn ? '/profile' : { pathname: '/trust', params: { from: 'connect' } })}
              />
              <Button label={imported ? 'Remove from this phone' : 'Disconnect'} variant="secondary" onPress={() => void disconnect()} />
            </View>
          </>
        ) : null}
      </ScrollBody>
    </Screen>
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
