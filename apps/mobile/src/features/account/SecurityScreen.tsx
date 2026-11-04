import { ASSETS, asset as assetSpec, isAssetAddress, shortAddress } from '@xrp/ledger';
import { ScrollView } from 'react-native-gesture-handler';
import { CoinLogo } from '@/components/CoinLogo';
import { changePasswordSchema } from '@xrp/schemas';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppLockToggle } from '@/components/AppLockToggle';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CopyButton } from '@/components/CopyButton';
import { ErrorText, Field, Help, Label, OtpInput, TextField } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Grab, Sheet } from '@/components/Sheet';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { Toggle } from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useAllowlist, useApiMutation, useDevices, useProfile, useSecurityEvents } from '@/data/hooks';
import { hm, isSameDay, md } from '@/lib/dates';
import { useNoScreenCapture } from '@/lib/useNoScreenCapture';
import { PHRASE_MISMATCH, PhraseEntry } from './PhraseCheck';
import { useTheme } from '@/theme';
import { slopFor } from '@/components/hitSlop';

/** `.val` on Security — 12.5px text-3. */
const Val = ({ children }: { children: string }) => (
  <T size={12.5} color="text3">
    {children}
  </T>
);

/** `.mini.danger` — Remove / Sign out (14/400 neg as a design `<button>`). */
const DangerMini = ({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={slopFor(32)}
      style={({ pressed }) => ({
        height: 32,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: c.borderStrong,
        borderRadius: 8,
        backgroundColor: pressed ? c.sunken : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <T color="neg">{label}</T>
    </Pressable>
  );
};

const hoursUntil = (iso: string, now: number) => Math.max(1, Math.ceil((Date.parse(iso) - now) / 3_600_000));
const monthsAgo = (iso: string, now: number) => {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (days < 1) return 'Changed just now';
  if (days < 30) return `Last changed ${days} day${days === 1 ? '' : 's'} ago`;
  const m = Math.floor(days / 30);
  return `Last changed ${m} month${m === 1 ? '' : 's'} ago`;
};

export const SecurityScreen = () => {
  useNoScreenCapture('security');
  const router = useRouter();
  const { c } = useTheme();
  const showToast = useToast((s) => s.show);
  const toast = (m: string) => showToast(m, { bottom: 32, durationMs: 2800 });
  const profile = useProfile();
  const allowlist = useAllowlist();
  const devices = useDevices();
  const events = useSecurityEvents();
  const twofa = useApiMutation(api.setTwoFactor);
  const regen = useApiMutation(api.regenerateBackupCodes);
  const allow = useApiMutation(api.setAllowlist);
  const changePw = useApiMutation(({ current, next }: { current: string; next: string }) => api.changePassword(current, next));
  const addAddr = useApiMutation(api.addAllowlistAddress);
  const removeAddr = useApiMutation(api.removeAllowlistAddress);
  const revoke = useApiMutation(api.revokeDevice);
  const enablePhrase = useApiMutation(api.enablePhrase);
  const disablePhrase = useApiMutation(api.disablePhrase);
  const [sheet, setSheet] = useState<'codes' | 'pw' | 'add' | 'totp' | 'off' | 'phrase' | 'phraseOff' | null>(null);
  /** Setup: pick 6 from the 30 (`first`), then pick them again from a shuffled grid to prove they're remembered. */
  const [ps, setPs] = useState<{ stage: 'pick' | 'confirm'; words: string[]; first: string[]; picked: string[]; error: string } | null>(null);
  const [offPhrase, setOffPhrase] = useState<{ words: string[]; picked: string[]; error: string } | null>(null);
  const [totp, setTotp] = useState<{ factorId: string; uri: string; secret: string; code: string; error: string; busy: boolean } | null>(null);
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '', tried: false });
  const [pwError, setPwError] = useState('');
  const [ad, setAd] = useState({ asset: 'XRP', label: '', address: '', tag: '', tried: false });
  const now = api.now().getTime();
  const p = profile.data;

  const pwParse = changePasswordSchema.safeParse(pw);
  const pwErr = (path: string) => (pw.tried && !pwParse.success ? (pwParse.error.issues.find((i) => i.path[0] === path)?.message ?? '') : '');
  const adLabelErr = ad.tried && !ad.label.trim() ? 'Give this address a name.' : '';
  const adSpec = assetSpec(ad.asset);
  const adNetworks = adSpec.networks.map((n) => n.name).join(' or ');
  const adAddrErr =
    ad.tried && !isAssetAddress(ad.asset, ad.address)
      ? `Enter a valid ${adNetworks} address.${adSpec.networks.length === 1 ? ` ${adSpec.addressHint}` : ''}`
      : '';

  const savePw = async () => {
    if (!pwParse.success) {
      setPw((s) => ({ ...s, tried: true }));
      return;
    }
    try {
      await changePw.mutateAsync({ current: pw.current, next: pw.next });
      setSheet(null);
      toast('Password updated. Other devices were signed out.');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'We couldn’t change your password.');
    }
  };
  /** Set up an authenticator, or cancel a pending turn-off if one is still in place. */
  const turnOnTwoFactor = async () => {
    try {
      const setup = await api.startTotpEnrollment();
      if (!setup) {
        await twofa.mutateAsync(true);
        toast('Two-factor stays on.');
        return;
      }
      setTotp({ ...setup, code: '', error: '', busy: false });
      setSheet('totp');
    } catch {
      toast('We couldn’t start authenticator setup. Try again.');
    }
  };
  const confirmTotp = async () => {
    if (!totp) return;
    if (!/^\d{6}$/.test(totp.code)) {
      setTotp({ ...totp, error: 'Enter the 6-digit code from your authenticator app.' });
      return;
    }
    setTotp({ ...totp, busy: true, error: '' });
    const r = await api.confirmTotpEnrollment(totp.factorId, totp.code).catch(() => ({ ok: false }));
    if (!r.ok) {
      setTotp({ ...totp, busy: false, error: 'That code didn’t match. Check your authenticator app and try again.' });
      return;
    }
    await twofa.mutateAsync(true).catch(() => undefined);
    setTotp(null);
    toast('Two-factor is on.');
    // Backup codes are the way back in if the phone is lost, so they come straight after setup.
    setFreshCodes(await regen.mutateAsync(undefined).catch(() => null));
    setSheet('codes');
  };
  const startPhrase = async () => {
    try {
      const words = await api.startPhraseSetup();
      setPs({ stage: 'pick', words, first: [], picked: [], error: '' });
      setSheet('phrase');
    } catch {
      toast('We couldn’t start security phrase setup. Try again.');
    }
  };
  const nextPhraseStage = async () => {
    if (!ps) return;
    if (ps.stage === 'pick') {
      setPs({ ...ps, stage: 'confirm', first: ps.picked, picked: [], words: [...ps.words].sort(() => Math.random() - 0.5) });
      return;
    }
    if (ps.picked.join(' ') !== ps.first.join(' ')) {
      setPs({ ...ps, picked: [], error: 'That isn’t the same 6 words in the same order. Try again.' });
      return;
    }
    try {
      await enablePhrase.mutateAsync(ps.first);
      setSheet(null);
      setPs(null);
      toast('Security phrase is on. We’ll ask for it at sign-in, withdrawals and deposits.');
    } catch (e) {
      setPs({ ...ps, picked: [], error: e instanceof Error ? e.message : 'We couldn’t turn on your security phrase. Try again.' });
    }
  };
  const startPhraseOff = async () => {
    const ch = await api.phraseChallenge().catch(() => null);
    if (!ch) {
      toast('We couldn’t load your security phrase. Try again.');
      return;
    }
    setOffPhrase({ words: ch.words, picked: [], error: '' });
    setSheet('phraseOff');
  };
  const turnOffPhrase = async () => {
    if (!offPhrase) return;
    const r = await disablePhrase.mutateAsync(offPhrase.picked).then(
      (x) => (x.ok ? '' : PHRASE_MISMATCH),
      (e: unknown) => (e instanceof Error ? e.message : 'We couldn’t turn off your security phrase. Try again.'),
    );
    if (r) {
      setOffPhrase({ ...offPhrase, picked: [], error: r });
      return;
    }
    setSheet(null);
    setOffPhrase(null);
    toast('Security phrase is off.');
  };
  const saveAddr = async () => {
    if (!ad.label.trim() || !isAssetAddress(ad.asset, ad.address)) {
      setAd((s) => ({ ...s, tried: true }));
      return;
    }
    await addAddr.mutateAsync({
      asset: ad.asset,
      label: ad.label.trim(),
      address: ad.address.trim(),
      tag: adSpec.memo === 'tag' ? ad.tag || null : null,
      memo: adSpec.memo === 'memo' ? ad.tag || null : null,
    });
    setSheet(null);
    toast('Address added. Check your email to confirm it.');
  };

  return (
    <Screen>
      <ScrollBody>
        <TopBar title="Security" leadingLabel="Back to Profile" />
        <Sec top={0}>Sign-in</Sec>
        <Card>
          <AppLockToggle first />
          <Row first={false}>
            <View style={{ flex: 1, gap: 1 }}>
              <T weight={500}>Two-factor authentication</T>
              <Val>Optional · a code from an authenticator app at sign-in</Val>
            </View>
            <Toggle label="Two-factor authentication" on={!!p?.twoFactorEnabled} onChange={(v) => (v ? void turnOnTwoFactor() : setSheet('off'))} />
          </Row>
          {p?.twoFactorOffAt ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
              <Banner tone="warn">{`Two-factor turns off in ${hoursUntil(p.twoFactorOffAt, now)}h, and withdrawals are paused until then. Turn it back on to cancel.`}</Banner>
            </View>
          ) : null}
          {p?.twoFactorEnabled ? (
            <Row
              onPress={() => {
                setFreshCodes(null);
                setSheet('codes');
              }}
              chevron
            >
              <View style={{ flex: 1, gap: 1 }}>
                <T weight={500}>Backup codes</T>
                <Val>{`${p.backupCodesUnused} of 8 unused`}</Val>
              </View>
            </Row>
          ) : null}
          <Row first={false}>
            <View style={{ flex: 1, gap: 1 }}>
              <T weight={500}>Security phrase</T>
              <Val>Optional · 6 words asked at sign-in, withdrawals and deposits</Val>
            </View>
            <Toggle label="Security phrase" on={!!p?.securityPhraseEnabled} onChange={(v) => void (v ? startPhrase() : startPhraseOff())} />
          </Row>
          <Row
            onPress={() => {
              setPw({ current: '', next: '', confirm: '', tried: false });
              setPwError('');
              setSheet('pw');
            }}
            chevron
          >
            <View style={{ flex: 1, gap: 1 }}>
              <T weight={500}>Password</T>
              <Val>{p ? monthsAgo(p.passwordChangedAt, now) : ''}</Val>
            </View>
          </Row>
        </Card>

        <Sec top={22}>Withdrawal allowlist</Sec>
        <Card>
          <Row first>
            <View style={{ flex: 1, gap: 1 }}>
              <T weight={500}>Only allow saved addresses</T>
              <Val>{p?.allowlistEnabled ? 'Withdrawals only go to the addresses below' : 'Off · any valid address can receive withdrawals'}</Val>
            </View>
            <Toggle label="Only allow saved addresses" on={!!p?.allowlistEnabled} onChange={(v) => allow.mutate(v)} />
          </Row>
          {(allowlist.data ?? []).map((a) => {
            const active = Date.parse(a.activeFrom) <= now;
            return (
              <Row key={a.id}>
                <CoinLogo asset={a.asset} size={28} />
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <T weight={500}>{`${a.label} · ${a.asset}`}</T>
                  <T size={12} mono color="text3">{`${shortAddress(a.address)}${a.tag ? ` · tag ${a.tag}` : a.memo ? ` · memo ${a.memo}` : ''}`}</T>
                  <Status tone={active ? 'ok' : 'wait'} label={active ? 'Active' : `Activates in ${hoursUntil(a.activeFrom, now)}h`} base="text" />
                </View>
                <DangerMini
                  label="Remove"
                  accessibilityLabel={`Remove ${a.label}`}
                  onPress={async () => {
                    await removeAddr.mutateAsync(a.id);
                    toast(`${a.label} removed from your allowlist.`);
                  }}
                />
              </Row>
            );
          })}
          <Row
            onPress={() => {
              setAd({ asset: 'XRP', label: '', address: '', tag: '', tried: false });
              setSheet('add');
            }}
          >
            <Icon name="plus" size="sm" color="accentText" />
            <T weight={500} color="accentText">
              Add address
            </T>
          </Row>
        </Card>

        <Sec top={22}>Signed-in devices</Sec>
        <Card>
          {(devices.data ?? []).map((d, i) => (
            <Row key={d.id} first={i === 0}>
              <Icon name={d.kind === 'phone' ? 'phoneSquare' : 'laptop'} color="text2" />
              <View style={{ flex: 1, gap: 1 }}>
                <T weight={500}>{d.name}</T>
                <Val>
                  {d.current
                    ? `${d.location} · active now`
                    : `${d.location} · ${isSameDay(d.lastActive, api.now()) ? `today ${hm(d.lastActive)}` : md(d.lastActive)}`}
                </Val>
              </View>
              {d.current ? (
                <Val>This device</Val>
              ) : (
                <DangerMini
                  label="Sign out"
                  accessibilityLabel={`Sign out ${d.name}`}
                  onPress={async () => {
                    await revoke.mutateAsync(d.id);
                    toast(`${d.name} signed out.`);
                  }}
                />
              )}
            </Row>
          ))}
        </Card>

        <Sec top={22}>Recent security activity</Sec>
        <Card>
          {(events.data ?? []).slice(0, 6).map((e, i) => (
            <Row key={e.id} first={i === 0}>
              <View style={{ flex: 1, gap: 1 }}>
                <T weight={500}>{e.title}</T>
                <Val>{e.meta}</Val>
              </View>
            </Row>
          ))}
        </Card>
        <Help style={{ marginTop: 14, marginHorizontal: 4 }}>
          Something you don’t recognise?{' '}
          <T size={12.5} lh={1.45} color="accentText" underline accessibilityRole="link" onPress={() => router.push('/support')}>
            Contact support
          </T>{' '}
          — we’ll never ask for your password or codes.
        </Help>
      </ScrollBody>

      <Sheet open={sheet === 'off'} onClose={() => setSheet(null)} scrim="deep" shadow="strong" maxHeight={0.88} accessibilityLabel="Turn off two-factor">
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 6 }} accessibilityRole="header">
          Turn off two-factor?
        </T>
        <Help style={{ marginBottom: 16 }}>It turns off after a 24-hour security hold, and withdrawals pause during that time. You can cancel any time before then.</Help>
        <View style={{ gap: 10 }}>
          <Button
            label="Turn off"
            textColor="neg"
            variant="secondary"
            loading={twofa.isPending}
            onPress={async () => {
              await twofa.mutateAsync(false).catch(() => toast('We couldn’t turn off two-factor. Try again.'));
              setSheet(null);
            }}
          />
          <Button label="Keep it on" onPress={() => setSheet(null)} />
        </View>
      </Sheet>

      <Sheet open={sheet === 'phrase'} onClose={() => setSheet(null)} scrim="deep" shadow="strong" maxHeight={0.92} accessibilityLabel="Set up your security phrase">
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 6 }} accessibilityRole="header">
          {ps?.stage === 'confirm' ? 'Confirm your security phrase' : 'Choose your security phrase'}
        </T>
        <Help style={{ marginBottom: 14 }}>
          {ps?.stage === 'confirm'
            ? 'Tap the same 6 words again, in the same order. The words have been mixed up.'
            : 'Tap 6 words. The order you tap them is part of your phrase. Write them down and keep them somewhere safe and offline.'}
        </Help>
        {ps ? (
          <PhraseEntry
            words={ps.words}
            picked={ps.picked}
            onPick={(picked) => setPs({ ...ps, picked, error: '' })}
            error={ps.error}
            busy={enablePhrase.isPending}
            submitLabel={ps.stage === 'confirm' ? 'Turn on security phrase' : 'Continue'}
            onSubmit={() => void nextPhraseStage()}
          />
        ) : null}
        {ps?.stage === 'confirm' ? (
          <Button
            label="Choose different words"
            variant="secondary"
            style={{ marginTop: 10 }}
            onPress={() => setPs({ ...ps, stage: 'pick', picked: [], first: [], error: '' })}
          />
        ) : null}
      </Sheet>

      <Sheet open={sheet === 'phraseOff'} onClose={() => setSheet(null)} scrim="deep" shadow="strong" maxHeight={0.92} accessibilityLabel="Turn off security phrase">
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 6 }} accessibilityRole="header">
          Turn off security phrase?
        </T>
        <Help style={{ marginBottom: 14 }}>Tap your 6 words in order to turn it off.</Help>
        {offPhrase ? (
          <PhraseEntry
            words={offPhrase.words}
            picked={offPhrase.picked}
            onPick={(picked) => setOffPhrase({ ...offPhrase, picked, error: '' })}
            error={offPhrase.error}
            busy={disablePhrase.isPending}
            submitLabel="Turn off"
            onSubmit={() => void turnOffPhrase()}
          />
        ) : null}
        <Button label="Keep it on" variant="secondary" style={{ marginTop: 10 }} onPress={() => setSheet(null)} />
      </Sheet>

      <Sheet open={sheet === 'codes'} onClose={() => setSheet(null)} scrim="deep" shadow="strong" maxHeight={0.88} accessibilityLabel="Backup codes">
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 6 }} accessibilityRole="header">
          Backup codes
        </T>
        <Help style={{ marginBottom: 14 }}>Each code works once if you lose your authenticator. Store them somewhere safe and offline.</Help>
        <View accessibilityLabel={freshCodes ? 'Your new backup codes' : 'Backup codes are hidden'} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(freshCodes ?? Array.from({ length: p?.backupCodesUnused ?? 0 }, () => '••••-••••')).map((code, i) => (
            <View key={`${code}-${i}`} style={{ width: '48.5%', flexGrow: 1, padding: 10, borderRadius: 8, backgroundColor: c.sunken, alignItems: 'center' }}>
              <T mono ls={0.06} selectable={!!freshCodes}>
                {code}
              </T>
            </View>
          ))}
        </View>
        <Help style={{ marginTop: 10 }}>
          {freshCodes ? 'Shown once. Save them now — we only store a secure hash.' : 'For your security, codes are shown only when they’re generated.'}
        </Help>
        <View style={{ gap: 10, marginTop: 16 }}>
          <Button
            label="Generate new codes"
            variant="secondary"
            loading={regen.isPending}
            onPress={async () => {
              const codes = await regen.mutateAsync(undefined);
              setFreshCodes(codes);
              toast('New codes generated. The old ones no longer work.');
            }}
          />
          <Button label="Done" onPress={() => setSheet(null)} />
        </View>
      </Sheet>

      <Sheet open={sheet === 'totp'} onClose={() => setSheet(null)} scrim="deep" shadow="strong" maxHeight={0.92} accessibilityLabel="Set up your authenticator">
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 6 }} accessibilityRole="header">
          Set up your authenticator
        </T>
        <Help style={{ marginBottom: 14 }}>Scan this code with an authenticator app, then enter the 6-digit code it shows.</Help>
        {totp ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <View
                accessibilityLabel="QR code for your authenticator app"
                style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: c.border }}
              >
                <QRCode value={totp.uri} size={108} color="#000000" backgroundColor="#FFFFFF" quietZone={4} ecl="M" />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <T size={12.5} color="text3">
                  Or enter this key
                </T>
                <T size={13} lh={1.5} mono selectable>
                  {totp.secret.replace(/(.{4})/g, '$1 ').trim()}
                </T>
                <CopyButton
                  label="Copy key"
                  icon={<Icon name="copy" size="sm" />}
                  onPress={() => {
                    Clipboard.setStringAsync(totp.secret).catch(() => undefined);
                    toast('Key copied');
                  }}
                />
              </View>
            </View>
            <View>
              <Label>Authentication code</Label>
              <OtpInput label="Authentication code" value={totp.code} onChange={(v) => setTotp({ ...totp, code: v, error: '' })} invalid={!!totp.error} />
              <ErrorText>{totp.error}</ErrorText>
            </View>
            <Button label="Turn on two-factor" loading={totp.busy} onPress={() => void confirmTotp()} />
          </View>
        ) : null}
      </Sheet>

      <Sheet open={sheet === 'pw'} onClose={() => setSheet(null)} scrim="deep" shadow="strong" maxHeight={0.88} accessibilityLabel="Change password">
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 14 }} accessibilityRole="header">
          Change password
        </T>
        <View style={{ gap: 14 }}>
          <Field>
            <Label nativeID="pw-cur">Current password</Label>
            <TextField
              accessibilityLabelledBy="pw-cur"
              height={null}
              minHeight={50}
              style={{ height: 48 }}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              value={pw.current}
              onChangeText={(v) => setPw((s) => ({ ...s, current: v }))}
              invalid={!!pwErr('current')}
            />
            <ErrorText>{pwErr('current')}</ErrorText>
          </Field>
          <Field>
            <Label nativeID="pw-new">New password</Label>
            <TextField
              accessibilityLabelledBy="pw-new"
              height={null}
              minHeight={50}
              style={{ height: 48 }}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              value={pw.next}
              onChangeText={(v) => setPw((s) => ({ ...s, next: v }))}
              invalid={!!pwErr('next')}
            />
            <Help>12+ characters with a number and upper and lower case.</Help>
            <ErrorText>{pwErr('next')}</ErrorText>
          </Field>
          <Field>
            <Label nativeID="pw-conf">Confirm new password</Label>
            <TextField
              accessibilityLabelledBy="pw-conf"
              height={null}
              minHeight={50}
              style={{ height: 48 }}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              value={pw.confirm}
              onChangeText={(v) => setPw((s) => ({ ...s, confirm: v }))}
              invalid={!!pwErr('confirm')}
            />
            <ErrorText>{pwErr('confirm')}</ErrorText>
          </Field>
        </View>
        {pwError ? (
          <Banner tone="error" alert style={{ marginTop: 14 }}>
            {pwError}
          </Banner>
        ) : null}
        <Banner tone="warn" style={{ marginTop: 14 }}>
          Other devices will be signed out, and withdrawals pause for 24 hours.
        </Banner>
        <Button label="Update password" loading={changePw.isPending} onPress={savePw} style={{ marginTop: 14 }} />
      </Sheet>

      <Sheet open={sheet === 'add'} onClose={() => setSheet(null)} scrim="deep" shadow="strong" maxHeight={0.88} accessibilityLabel="Add withdrawal address">
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 14 }} accessibilityRole="header">
          Add withdrawal address
        </T>
        <View style={{ gap: 14 }}>
          <Field>
            <Label>Asset</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {ASSETS.map((x) => {
                const on = x.id === ad.asset;
                return (
                  <Pressable
                    key={x.id}
                    accessibilityRole="button"
                    accessibilityLabel={x.name}
                    accessibilityState={{ selected: on }}
                    onPress={() => setAd((s) => ({ ...s, asset: x.id, address: '', tag: '', tried: false }))}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      height: 40,
                      paddingLeft: 6,
                      paddingRight: 12,
                      borderRadius: 20,
                      borderWidth: on ? 1.5 : 1,
                      borderColor: on ? c.accent : c.border,
                      backgroundColor: on ? c.accentSoft : c.surface,
                    }}
                  >
                    <CoinLogo asset={x.id} size={26} />
                    <T weight={500}>{x.id}</T>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Field>
          <Field>
            <Label nativeID="ad-label">Name</Label>
            <TextField
              accessibilityLabelledBy="ad-label"
              height={null}
              minHeight={50}
              style={{ height: 48 }}
              placeholder="e.g. My hardware wallet"
              value={ad.label}
              onChangeText={(v) => setAd((s) => ({ ...s, label: v }))}
              invalid={!!adLabelErr}
            />
            <ErrorText>{adLabelErr}</ErrorText>
          </Field>
          <Field>
            <Label nativeID="ad-addr">{`${adNetworks} address`}</Label>
            <TextField
              accessibilityLabelledBy="ad-addr"
              height={null}
              minHeight={50}
              style={{ height: 48 }}
              size={13.5}
              placeholder={adSpec.addressHint}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              value={ad.address}
              onChangeText={(v) => setAd((s) => ({ ...s, address: v.trim() }))}
              invalid={!!adAddrErr}
            />
            <ErrorText>{adAddrErr}</ErrorText>
          </Field>
          {adSpec.memo ? (
            <Field>
              <Label nativeID="ad-tag" optional>
                {adSpec.memo === 'tag' ? 'Destination tag' : 'Memo'}
              </Label>
              <TextField
                accessibilityLabelledBy="ad-tag"
                height={null}
                minHeight={50}
                style={{ height: 48 }}
                keyboardType={adSpec.memo === 'tag' ? 'number-pad' : 'default'}
                value={ad.tag}
                onChangeText={(v) => setAd((s) => ({ ...s, tag: adSpec.memo === 'tag' ? v.replace(/\D/g, '') : v }))}
              />
            </Field>
          ) : null}
        </View>
        <Banner tone="info" style={{ marginTop: 14 }}>
          New addresses activate after 24 hours, and we’ll email you to confirm. This protects you if someone gets into your account.
        </Banner>
        <Button label="Add address" loading={addAddr.isPending} onPress={saveAddr} style={{ marginTop: 14 }} />
      </Sheet>
    </Screen>
  );
};
