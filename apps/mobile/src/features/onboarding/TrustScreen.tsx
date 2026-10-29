import { COUNTRIES, countryByCode, currencyForCountry } from '@xrp/ledger';
import { EMAIL, passwordRules } from '@xrp/schemas';
import type { BeneficiaryRelationship, TrustInput, TrustType } from '@xrp/types';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge } from '@/components/Badge';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow, ErrorText, Field, Help, Label, Radio, TextField } from '@/components/Form';
import { Footer } from '@/components/Footer';
import { HeroIcon } from '@/components/Glyph';
import { Icon } from '@/components/Icon';
import { KV } from '@/components/KV';
import { Screen, ScrollBody } from '@/components/Screen';
import { Select } from '@/components/Select';
import { StepBar } from '@/components/Steps';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useProfile } from '@/data/hooks';
import { readWalletAddress } from '@/lib/walletAddress';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

/** Where the customer came from: Create account, Connect a wallet, or an existing account without a trust. */
type From = 'create' | 'connect' | 'existing';

const TYPES: { value: TrustType; title: string; body: string }[] = [
  { value: 'revocable', title: 'Revocable trust', body: 'You stay in control: change your beneficiaries or cancel the trust whenever you like.' },
  { value: 'irrevocable', title: 'Irrevocable trust', body: 'Fixed once it’s set up. The assets are held for your beneficiaries and can’t be taken back.' },
  { value: 'spendthrift', title: 'Spendthrift trust', body: 'Protects your beneficiaries’ shares: they can’t sign them away or borrow against them.' },
];
const TYPE_NAMES: Record<TrustType, string> = { revocable: 'Revocable trust', irrevocable: 'Irrevocable trust', spendthrift: 'Spendthrift trust' };

const RELATIONSHIPS: { value: Exclude<BeneficiaryRelationship, 'self'>; label: string }[] = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'charity', label: 'Charity' },
  { value: 'other', label: 'Other' },
];
/** The United States first, then every country A to Z. */
const COUNTRY_OPTIONS = [{ value: 'US', label: 'United States' }, ...COUNTRIES.filter((c) => c.code !== 'US').map((c) => ({ value: c.code, label: c.name }))];

type Beneficiary = { name: string; relationship: string; email: string; allocation: string; wallet: string };
const blank = (): Beneficiary => ({ name: '', relationship: '', email: '', allocation: '', wallet: '' });

/** "12/04/1990" → "1990-04-12", or null if it isn't a real date. */
const parseDob = (text: string): string | null => {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
};
const ageOf = (iso: string) => (Date.now() - Date.parse(`${iso}T00:00:00Z`)) / (365.25 * 86_400_000);
const pct = (v: string) => (/^\d{1,3}$/.test(v) ? Number(v) : NaN);
const walletOk = (v: string) => !v.trim() || readWalletAddress(v) !== null;

/**
 * Create your crypto trust: the first step for everyone, before an account or a wallet connection. Four steps —
 * trust type, personal information (which also creates the account), beneficiaries whose shares total 100%, and a
 * review. Everything is stored with the account; staff see it on the customer's profile.
 */
export const TrustScreen = () => {
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ from?: string }>();
  const from: From = params.from === 'connect' ? 'connect' : params.from === 'existing' ? 'existing' : 'create';
  const signedIn = useSession((s) => s.signedIn);
  const setSignedIn = useSession((s) => s.setSignedIn);
  const setPendingEmail = useSession((s) => s.setPendingEmail);
  const profile = useProfile();
  const [accountMade, setAccountMade] = useState(signedIn);
  const [step, setStep] = useState(0); // 0 = intro, 1–4 = the form
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [type, setType] = useState<TrustType | null>(null);
  const [p, setP] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '', dob: '', address: '', city: '', region: '', zip: '', country: 'US' });
  const [self, setSelf] = useState({ on: false, allocation: '', wallet: '' });
  const [list, setList] = useState<Beneficiary[]>([blank()]);
  const [agree, setAgree] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // An existing account: name and country come from the record; no email or password to ask for.
  useEffect(() => {
    if (!accountMade || !profile.data) return;
    const [first = '', ...rest] = profile.data.fullName.split(' ');
    setP((x) => ({ ...x, firstName: x.firstName || first, lastName: x.lastName || rest.join(' '), country: countryByCode(profile.data.country) ? profile.data.country : x.country }));
  }, [accountMade, profile.data]);

  const set = (k: keyof typeof p) => (v: string) => setP((x) => ({ ...x, [k]: v }));
  const dobIso = parseDob(p.dob);
  const total = (self.on ? pct(self.allocation) || 0 : 0) + list.reduce((n, b) => n + (pct(b.allocation) || 0), 0);

  const personalErrors: Partial<Record<keyof typeof p, string>> = {
    firstName: p.firstName.trim() ? '' : 'Enter your first name.',
    lastName: p.lastName.trim() ? '' : 'Enter your last name.',
    email: accountMade || EMAIL.test(p.email.trim()) ? '' : 'Enter a valid email.',
    password: accountMade || passwordRules(p.password).every((r) => r.met) ? '' : 'Use 12+ characters with upper and lower case and a number.',
    phone: /^[0-9]{6,15}$/.test(p.phone.replace(/[^0-9]/g, '')) ? '' : 'Enter your phone number with country code.',
    dob: !dobIso ? 'Enter your date of birth as DD/MM/YYYY.' : ageOf(dobIso) < 18 ? 'You must be 18 or older.' : '',
    address: p.address.trim() ? '' : 'Enter your street address.',
    city: p.city.trim() ? '' : 'Enter your city.',
    region: p.region.trim() ? '' : 'Enter your state.',
    zip: p.zip.trim() ? '' : 'Enter your ZIP code.',
    country: p.country ? '' : 'Choose your country.',
  };
  const benError = (b: Beneficiary) =>
    !b.name.trim()
      ? 'Enter their name.'
      : !b.relationship
        ? 'Choose their relationship to you.'
        : b.email.trim() && !EMAIL.test(b.email.trim())
          ? 'That email doesn’t look right.'
          : !(pct(b.allocation) >= 1 && pct(b.allocation) <= 100)
            ? 'Their share must be 1–100%.'
            : !walletOk(b.wallet)
              ? 'That isn’t a wallet address we recognise.'
              : '';
  const selfError = self.on ? (!(pct(self.allocation) >= 1 && pct(self.allocation) <= 100) ? 'Your share must be 1–100%.' : !walletOk(self.wallet) ? 'That isn’t a wallet address we recognise.' : '') : '';
  const stepValid = [
    true,
    type !== null,
    Object.values(personalErrors).every((e) => !e),
    !selfError && list.every((b) => !benError(b)) && (self.on || list.length > 0) && total === 100,
    agree,
  ];

  const next = () => {
    if (!stepValid[step]) {
      setTried(true);
      return;
    }
    setTried(false);
    setError('');
    setStep((s) => s + 1);
  };
  const back = () => {
    setTried(false);
    setError('');
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  const submit = async () => {
    if (!agree || !type) {
      setTried(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!accountMade) {
        await api.signUp({
          name: `${p.firstName.trim()} ${p.lastName.trim()}`,
          email: p.email.trim(),
          password: p.password,
          country: p.country,
          currency: currencyForCountry(p.country),
          updates: false,
        });
        setPendingEmail(p.email.trim());
        setAccountMade(true);
      }
      const input: TrustInput = {
        type,
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        phone: p.phone.trim(),
        dob: dobIso ?? '',
        address: p.address.trim(),
        city: p.city.trim(),
        region: p.region.trim(),
        postalCode: p.zip.trim(),
        country: p.country,
        beneficiaries: [
          ...(self.on ? [{ isSelf: true, name: '', relationship: 'self' as const, email: '', allocationPct: pct(self.allocation), wallet: self.wallet.trim() }] : []),
          ...list.map((b) => ({
            isSelf: false,
            name: b.name.trim(),
            relationship: b.relationship as BeneficiaryRelationship,
            email: b.email.trim(),
            allocationPct: pct(b.allocation),
            wallet: b.wallet.trim(),
          })),
        ],
      };
      await api.createTrust(input);
      await qc.invalidateQueries();
      setSignedIn(true);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t create your trust. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const err = (k: keyof typeof p) => (tried ? personalErrors[k] : '');
  const country = countryByCode(p.country);

  return (
    <Screen>
      <ScrollBody bottom={step >= 1 && step <= 4 ? 112 : 32}>
        {step <= 4 ? <TopBar leading="back" label={step === 0 ? 'Get started' : `Step ${step} of 4`} onLeading={back} /> : null}
        {step >= 1 && step <= 4 ? <StepBar total={4} current={step} style={{ marginBottom: 22 }} /> : null}
        {error ? (
          <Banner tone="error" icon="alert" alert style={{ marginBottom: 14 }}>
            {error}
          </Banner>
        ) : null}

        {step === 0 ? (
          <View style={{ gap: 14, paddingTop: 12 }}>
            <HeroIcon icon="shieldCheck" tone="ok" size={52} />
            <T size={24} weight={600} ls={-0.02} accessibilityRole="header">
              Create Your Crypto Trust First
            </T>
            <T lh={1.5} color="text2">
              {`${
                from === 'connect' ? 'Before connecting a wallet' : from === 'existing' ? 'Before continuing' : 'Before creating your account'
              }, create your crypto trust. Define who will receive your digital assets and how they will be distributed. The process takes about 3 minutes.`}
            </T>
            <Card style={{ padding: 14, gap: 10 }}>
              {['Choose a Trust Type', 'Enter Your Personal Information', 'Add Beneficiaries and Allocate Shares', 'Review and Create Your Trust'].map((x, i) => (
                <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={12} weight={600} color="text2">
                      {String(i + 1)}
                    </T>
                  </View>
                  <T>{x}</T>
                </View>
              ))}
            </Card>
            <Banner tone="info" icon="info">
              Creating a trust is free. All three trust types are available at no cost.
            </Banner>
            <Button label="Create My Trust" onPress={() => setStep(1)} style={{ marginTop: 6 }} />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={{ gap: 12 }}>
            <T size={24} weight={600} ls={-0.02} accessibilityRole="header">
              Choose your trust type
            </T>
            {TYPES.map((t) => (
              <Pressable
                key={t.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: type === t.value }}
                onPress={() => setType(t.value)}
                style={{ borderWidth: type === t.value ? 1.5 : 1, borderColor: type === t.value ? c.accent : c.border, borderRadius: 14, backgroundColor: c.surface, padding: 16, gap: 6 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Radio on={type === t.value} />
                  <T weight={600} style={{ flex: 1 }}>
                    {t.title}
                  </T>
                  <Badge label="100% FREE" tone="ok" />
                </View>
                <T size={13} lh={1.5} color="text2" style={{ marginLeft: 30 }}>
                  {t.body}
                </T>
              </Pressable>
            ))}
            <ErrorText>{tried && !type ? 'Choose a trust type.' : ''}</ErrorText>
            <Help>A general description of each type, not legal advice.</Help>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: 16 }}>
            <T size={24} weight={600} ls={-0.02} accessibilityRole="header">
              Your personal information
            </T>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field style={{ flex: 1 }}>
                <Label nativeID="t-first">First name</Label>
                <TextField accessibilityLabelledBy="t-first" value={p.firstName} onChangeText={set('firstName')} invalid={!!err('firstName')} autoComplete="given-name" height={48} />
                <ErrorText>{err('firstName')}</ErrorText>
              </Field>
              <Field style={{ flex: 1 }}>
                <Label nativeID="t-last">Last name</Label>
                <TextField accessibilityLabelledBy="t-last" value={p.lastName} onChangeText={set('lastName')} invalid={!!err('lastName')} autoComplete="family-name" height={48} />
                <ErrorText>{err('lastName')}</ErrorText>
              </Field>
            </View>
            {!accountMade ? (
              <>
                <Field>
                  <Label nativeID="t-email">Email</Label>
                  <TextField
                    accessibilityLabelledBy="t-email"
                    value={p.email}
                    onChangeText={(v) => set('email')(v.trim())}
                    invalid={!!err('email')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    placeholder="you@example.com"
                    height={48}
                  />
                  <ErrorText>{err('email')}</ErrorText>
                </Field>
                <Field>
                  <Label nativeID="t-pass">Password</Label>
                  <TextField
                    accessibilityLabelledBy="t-pass"
                    value={p.password}
                    onChangeText={set('password')}
                    invalid={!!err('password')}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    height={48}
                    trailing={
                      <Pressable accessibilityRole="button" accessibilityLabel={showPass ? 'Hide password' : 'Show password'} onPress={() => setShowPass((x) => !x)} hitSlop={8}>
                        <Icon name="eye" size="sm" color="text3" />
                      </Pressable>
                    }
                  />
                  <ErrorText>{err('password')}</ErrorText>
                  <Help>12+ characters, with upper and lower case letters and a number.</Help>
                </Field>
              </>
            ) : null}
            <Field>
              <Label nativeID="t-phone">Phone</Label>
              <TextField accessibilityLabelledBy="t-phone" value={p.phone} onChangeText={set('phone')} invalid={!!err('phone')} keyboardType="phone-pad" autoComplete="tel" placeholder="+1 (555) 123-4567" height={48} />
              <ErrorText>{err('phone')}</ErrorText>
            </Field>
            <Field>
              <Label nativeID="t-dob">Date of birth</Label>
              <TextField
                accessibilityLabelledBy="t-dob"
                value={p.dob}
                onChangeText={(v) => {
                  const d = v.replace(/[^0-9]/g, '').slice(0, 8);
                  set('dob')([d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/'));
                }}
                invalid={!!err('dob')}
                keyboardType="number-pad"
                placeholder="DD/MM/YYYY"
                height={48}
              />
              <ErrorText>{err('dob')}</ErrorText>
            </Field>
            <Field>
              <Label nativeID="t-addr">Street address</Label>
              <TextField accessibilityLabelledBy="t-addr" value={p.address} onChangeText={set('address')} invalid={!!err('address')} autoComplete="street-address" height={48} />
              <ErrorText>{err('address')}</ErrorText>
            </Field>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field style={{ flex: 1 }}>
                <Label nativeID="t-city">City</Label>
                <TextField accessibilityLabelledBy="t-city" value={p.city} onChangeText={set('city')} invalid={!!err('city')} height={48} />
                <ErrorText>{err('city')}</ErrorText>
              </Field>
              <Field style={{ flex: 1 }}>
                <Label nativeID="t-region">State</Label>
                <TextField accessibilityLabelledBy="t-region" value={p.region} onChangeText={set('region')} invalid={!!err('region')} height={48} />
                <ErrorText>{err('region')}</ErrorText>
              </Field>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field style={{ flex: 1 }}>
                <Label nativeID="t-zip">ZIP code</Label>
                <TextField accessibilityLabelledBy="t-zip" value={p.zip} onChangeText={set('zip')} invalid={!!err('zip')} autoComplete="postal-code" height={48} />
                <ErrorText>{err('zip')}</ErrorText>
              </Field>
              <Field style={{ flex: 1.3 }}>
                <Label>Country</Label>
                <Select label="Country" value={p.country} placeholder="Select" options={COUNTRY_OPTIONS} onChange={set('country')} invalid={!!err('country')} height={48} />
                <ErrorText>{err('country')}</ErrorText>
              </Field>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: 14 }}>
            <T size={24} weight={600} ls={-0.02} accessibilityRole="header">
              Your beneficiaries
            </T>
            <T lh={1.5} color="text2">
              Who receives what’s in your trust, and in what shares. The shares must add up to 100%.
            </T>
            <Card style={{ padding: 14, gap: 12 }}>
              <CheckRow checked={self.on} onChange={(on) => setSelf((x) => ({ ...x, on }))}>
                Add myself as a beneficiary
              </CheckRow>
              {self.on ? (
                <View style={{ gap: 12 }}>
                  <Field>
                    <Label nativeID="t-self-pct">My share (%)</Label>
                    <TextField
                      accessibilityLabelledBy="t-self-pct"
                      value={self.allocation}
                      onChangeText={(v) => setSelf((x) => ({ ...x, allocation: v.replace(/[^0-9]/g, '').slice(0, 3) }))}
                      keyboardType="number-pad"
                      height={48}
                      invalid={tried && !!selfError}
                    />
                  </Field>
                  <Field>
                    <Label nativeID="t-self-wallet">My wallet address (optional)</Label>
                    <TextField accessibilityLabelledBy="t-self-wallet" value={self.wallet} onChangeText={(v) => setSelf((x) => ({ ...x, wallet: v }))} autoCapitalize="none" autoCorrect={false} placeholder="0x…, r…, bc1…" height={48} />
                  </Field>
                  <ErrorText>{tried ? selfError : ''}</ErrorText>
                </View>
              ) : null}
            </Card>
            {list.map((b, i) => {
              const upd = (k: keyof Beneficiary) => (v: string) => setList((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              const e = tried ? benError(b) : '';
              return (
                <Card key={i} style={{ padding: 14, gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T weight={600}>{`Beneficiary ${i + 1}`}</T>
                    {list.length > 1 || self.on ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove beneficiary ${i + 1}`} onPress={() => setList((xs) => xs.filter((_, j) => j !== i))} hitSlop={8}>
                        <T size={13} weight={600} color="neg">
                          Remove
                        </T>
                      </Pressable>
                    ) : null}
                  </View>
                  <Field>
                    <Label nativeID={`t-b${i}-name`}>Full name</Label>
                    <TextField accessibilityLabelledBy={`t-b${i}-name`} value={b.name} onChangeText={upd('name')} height={48} invalid={!!e && !b.name.trim()} />
                  </Field>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Field style={{ flex: 1.4 }}>
                      <Label>Relationship</Label>
                      <Select label="Relationship" value={b.relationship} placeholder="Select" options={RELATIONSHIPS} onChange={upd('relationship')} height={48} invalid={!!e && !b.relationship} />
                    </Field>
                    <Field style={{ flex: 1 }}>
                      <Label nativeID={`t-b${i}-pct`}>Share (%)</Label>
                      <TextField accessibilityLabelledBy={`t-b${i}-pct`} value={b.allocation} onChangeText={(v) => upd('allocation')(v.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" height={48} />
                    </Field>
                  </View>
                  <Field>
                    <Label nativeID={`t-b${i}-email`}>Email (optional)</Label>
                    <TextField accessibilityLabelledBy={`t-b${i}-email`} value={b.email} onChangeText={upd('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} height={48} />
                  </Field>
                  <Field>
                    <Label nativeID={`t-b${i}-wallet`}>Wallet address (optional)</Label>
                    <TextField accessibilityLabelledBy={`t-b${i}-wallet`} value={b.wallet} onChangeText={upd('wallet')} autoCapitalize="none" autoCorrect={false} placeholder="0x…" height={48} />
                  </Field>
                  <ErrorText>{e}</ErrorText>
                </Card>
              );
            })}
            {list.length + (self.on ? 1 : 0) < 10 ? (
              <Button label="Add another beneficiary" variant="secondary" icon={<Icon name="plus" size="sm" />} onPress={() => setList((xs) => [...xs, blank()])} />
            ) : null}
            <View
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 14,
                borderRadius: 12,
                backgroundColor: total === 100 ? c.accentSoft : total > 100 ? c.negSoft : c.sunken,
              }}
            >
              <T weight={500}>Total allocation</T>
              <T weight={600} num color={total === 100 ? 'pos' : total > 100 ? 'neg' : 'text'}>{`${total}%`}</T>
            </View>
            <ErrorText>{tried && total !== 100 ? `The shares add up to ${total}%. They must total 100%.` : ''}</ErrorText>
          </View>
        ) : null}

        {step === 4 && type ? (
          <View style={{ gap: 14 }}>
            <T size={24} weight={600} ls={-0.02} accessibilityRole="header">
              Review and create
            </T>
            <T size={13} weight={600} color="text2">
              Trust type
            </T>
            <Card>
              <KV items={[{ k: 'Type', v: TYPE_NAMES[type] }, { k: 'Cost', v: 'Free' }]} baseline={false} />
            </Card>
            <T size={13} weight={600} color="text2">
              Personal information
            </T>
            <Card>
              <KV
                items={[
                  { k: 'Name', v: `${p.firstName} ${p.lastName}` },
                  ...(!accountMade ? [{ k: 'Email', v: p.email }] : []),
                  { k: 'Phone', v: p.phone },
                  { k: 'Date of birth', v: p.dob },
                  { k: 'Address', v: `${p.address}, ${p.city}, ${p.region} ${p.zip}` },
                  { k: 'Country', v: country?.name ?? p.country },
                ]}
                baseline={false}
              />
            </Card>
            <T size={13} weight={600} color="text2">
              Beneficiaries
            </T>
            <Card>
              <KV
                items={[
                  ...(self.on ? [{ k: 'You', v: `${self.allocation}%`, sub: self.wallet ? self.wallet : undefined }] : []),
                  ...list.map((b) => ({
                    k: `${b.name} · ${RELATIONSHIPS.find((r) => r.value === b.relationship)?.label ?? ''}`,
                    v: `${b.allocation}%`,
                    sub: [b.email, b.wallet].filter(Boolean).join(' · ') || undefined,
                  })),
                  { k: 'Total', v: `${total}%` },
                ]}
                baseline={false}
              />
            </Card>
            <Banner tone="info" icon="check">
              Trust creation fee: FREE
            </Banner>
            <CheckRow checked={agree} onChange={setAgree}>
              <T size={13.5} lh={1.45}>
                I confirm these details are correct and agree to the{' '}
                <T size={13.5} lh={1.45} color="accentText" underline accessibilityRole="link" onPress={() => router.push('/legal')}>
                  Terms and Conditions
                </T>
                .
              </T>
            </CheckRow>
            <ErrorText>{tried && !agree ? 'Agree to the Terms and Conditions to create your trust.' : ''}</ErrorText>
          </View>
        ) : null}

        {step === 5 ? (
          <View style={{ gap: 14, paddingTop: 24 }}>
            <HeroIcon icon="check" tone="ok" size={52} />
            <T size={24} weight={600} ls={-0.02} accessibilityRole="header">
              Your trust is created
            </T>
            <T lh={1.5} color="text2">
              {from === 'existing'
                ? 'It’s saved with your account. You can see it in Profile.'
                : 'Your account and trust are ready. Next, verify your identity so you can deposit, swap and withdraw.'}
            </T>
            {from === 'connect' ? <Button label="Connect your wallet" onPress={() => router.replace('/connect-wallet')} /> : null}
            <Button
              label={from === 'existing' ? 'Continue' : 'Verify my identity'}
              variant={from === 'connect' ? 'secondary' : 'primary'}
              onPress={() => router.replace(from === 'existing' ? '/' : '/verify')}
            />
          </View>
        ) : null}
      </ScrollBody>

      {step >= 1 && step <= 4 ? (
        <Footer>
          <Button label="Back" variant="secondary" flex={1} onPress={back} />
          {step < 4 ? <Button label="Next" flex={1} onPress={next} /> : <Button label="Create trust" flex={1} loading={busy} onPress={() => void submit()} />}
        </Footer>
      ) : null}
    </Screen>
  );
};
