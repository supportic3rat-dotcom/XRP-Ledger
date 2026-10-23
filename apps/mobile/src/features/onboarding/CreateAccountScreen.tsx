import { zodResolver } from '@hookform/resolvers/zod';
import { createAccountSchema, passwordRules, type CreateAccountInput } from '@xrp/schemas';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CheckRow, ErrorText, Field, Help, Label, TextField } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { Screen, ScrollBody } from '@/components/Screen';
import { Select } from '@/components/Select';
import { StepBar } from '@/components/Steps';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useSession } from '@/state/session';

const COUNTRIES = [
  { value: '', label: 'Select' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'OTHER', label: 'Other' },
];
const CURRENCIES = ['USD', 'NGN', 'GBP', 'EUR'].map((v) => ({ value: v, label: v }));
const RESEND_SECONDS = 30;

export const CreateAccountScreen = () => {
  const router = useRouter();
  const setPendingEmail = useSession((s) => s.setPendingEmail);
  const setSignedIn = useSession((s) => s.setSignedIn);
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [showPass, setShowPass] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  const form = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { name: '', email: '', password: '', country: '', currency: 'USD', terms: false as unknown as true, updates: false },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const password = form.watch('password');
  const country = form.watch('country');
  const email = form.watch('email');
  const rules = passwordRules(password);
  const errors = form.formState.errors;

  useEffect(() => {
    if (step !== 'code' || resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resendIn]);

  const submit = form.handleSubmit(async (values) => {
    setBusy(true);
    setSubmitError('');
    try {
      await api.signUp({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        country: values.country,
        currency: values.currency,
        updates: values.updates,
      });
      setPendingEmail(values.email.trim());
      setResendIn(RESEND_SECONDS);
      setStep('code');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'We couldn’t create your account. Try again.');
    } finally {
      setBusy(false);
    }
  });

  const verify = async () => {
    setBusy(true);
    const r = await api.verifyEmailCode(email.trim(), code).finally(() => setBusy(false));
    if (!r.ok) {
      setCodeError('That code didn’t match. Check the latest email we sent.');
      return;
    }
    setSignedIn(true);
    router.replace('/verify');
  };

  const codeOk = /^\d{6}$/.test(code);

  return (
    <Screen>
      <ScrollBody>
        <TopBar
          leading="back"
          label={step === 'form' ? 'Step 1 of 3 · Account' : 'Step 2 of 3 · Verify email'}
          onLeading={() => (step === 'code' ? setStep('form') : router.back())}
        />
        <StepBar total={3} current={step === 'form' ? 1 : 2} style={{ marginBottom: 24 }} />

        {step === 'form' ? (
          <>
            <T size={24} weight={600} ls={-0.02} style={{ marginBottom: 6 }} accessibilityRole="header">
              Create your account
            </T>
            <T color="text2" style={{ marginBottom: 24 }}>
              We only ask for what we need to open a custodial account.
            </T>
            {submitError ? (
              <Banner tone="error" icon="alert" alert style={{ marginBottom: 16 }}>
                {submitError}
              </Banner>
            ) : null}
            <View style={{ gap: 18 }}>
              <Field>
                <Label nativeID="ca-name">Full legal name</Label>
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <TextField
                      accessibilityLabelledBy="ca-name"
                      height={48}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      invalid={!!errors.name}
                      placeholder="As shown on your ID"
                      autoComplete="name"
                      textContentType="name"
                    />
                  )}
                />
                <ErrorText>{errors.name?.message}</ErrorText>
              </Field>
              <Field>
                <Label nativeID="ca-email">Email</Label>
                <Controller
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <TextField
                      accessibilityLabelledBy="ca-email"
                      height={48}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      invalid={!!errors.email}
                      placeholder="you@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                    />
                  )}
                />
                <ErrorText>{errors.email?.message}</ErrorText>
              </Field>
              <Field>
                <Label nativeID="ca-pass">Password</Label>
                <Controller
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <TextField
                      accessibilityLabelledBy="ca-pass"
                      accessibilityHint="12 or more characters, with a number and upper and lower case"
                      height={48}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      invalid={!!errors.password}
                      secureTextEntry={!showPass}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      trailing={
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={showPass ? 'Hide password' : 'Show password'}
                          onPress={() => setShowPass((v) => !v)}
                          hitSlop={12}
                          style={{ paddingHorizontal: 2 }}
                        >
                          <T size={13} weight={500} color="accentText">
                            {showPass ? 'Hide' : 'Show'}
                          </T>
                        </Pressable>
                      }
                    />
                  )}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 14 }}>
                  {rules.map((r) => (
                    <View
                      key={r.label}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      accessibilityLabel={`${r.label}: ${r.met ? 'met' : 'not met'}`}
                    >
                      <Icon name={r.met ? 'check' : 'dot'} size="xs" color={r.met ? 'pos' : 'text3'} />
                      <T size={12.5} color={r.met ? 'pos' : 'text3'}>
                        {r.label}
                      </T>
                    </View>
                  ))}
                </View>
              </Field>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Field style={{ flex: 1.4, minWidth: 0 }}>
                  <Label>Country of residence</Label>
                  <Controller
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <Select
                        label="Country of residence"
                        height={48}
                        value={field.value}
                        onChange={field.onChange}
                        options={COUNTRIES}
                        invalid={!!errors.country}
                      />
                    )}
                  />
                </Field>
                <Field style={{ flex: 1, minWidth: 0 }}>
                  <Label>Display currency</Label>
                  <Controller
                    control={form.control}
                    name="currency"
                    render={({ field }) => <Select label="Display currency" height={48} value={field.value} onChange={field.onChange} options={CURRENCIES} />}
                  />
                </Field>
              </View>
              {errors.country ? <ErrorText style={{ marginTop: -10 }}>{errors.country.message}</ErrorText> : null}
              {country === 'OTHER' ? (
                <Banner tone="info" icon="info" style={{ marginTop: -6 }}>
                  Services depend on approved jurisdictions. We’ll tell you what’s available after you sign up.
                </Banner>
              ) : null}
              <View style={{ gap: 12, paddingTop: 4 }}>
                <Controller
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <CheckRow checked={!!field.value} onChange={(v) => field.onChange(v)}>
                      <T size={13.5} lh={1.45}>
                        I accept the{' '}
                        <T size={13.5} lh={1.45} color="accentText" underline accessibilityRole="link" onPress={() => router.push('/legal')}>
                          Terms of Service
                        </T>{' '}
                        and{' '}
                        <T size={13.5} lh={1.45} color="accentText" underline accessibilityRole="link" onPress={() => router.push('/legal')}>
                          Privacy Policy
                        </T>{' '}
                        (draft v0.1), and understand this is a{' '}
                        <T size={13.5} lh={1.45} weight={600}>
                          custodial
                        </T>{' '}
                        account.
                      </T>
                    </CheckRow>
                  )}
                />
                {errors.terms ? <ErrorText style={{ marginLeft: 30 }}>{errors.terms.message}</ErrorText> : null}
                <Controller
                  control={form.control}
                  name="updates"
                  render={({ field }) => (
                    <CheckRow checked={field.value} onChange={field.onChange} color="text2">
                      Email me product updates (optional)
                    </CheckRow>
                  )}
                />
              </View>
              <Button label="Continue" onPress={() => submit()} loading={busy} style={{ marginTop: 4 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
              <T size={13.5} color="text2">
                Already have an account?{' '}
                <T size={13.5} weight={500} color="accentText" underline accessibilityRole="link" onPress={() => router.replace('/sign-in')}>
                  Sign in
                </T>
              </T>
            </View>
          </>
        ) : (
          <>
            <T size={24} weight={600} ls={-0.02} style={{ marginBottom: 6 }} accessibilityRole="header">
              Check your email
            </T>
            <T color="text2" style={{ marginBottom: 24 }}>
              Enter the 6-digit code we sent to{' '}
              <T weight={600} color="text2">
                {email}
              </T>
              .
            </T>
            <Field>
              <Label nativeID="ca-code">Verification code</Label>
              <TextField
                accessibilityLabelledBy="ca-code"
                height={56}
                size={22}
                letterSpacingEm={0.3}
                value={code}
                invalid={!!codeError || (code.length === 6 && !codeOk)}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, '').slice(0, 6));
                  setCodeError('');
                }}
                placeholder="000000"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
              />
              <ErrorText>{codeError}</ErrorText>
              {resendIn > 0 ? (
                <Help>Didn’t get it? You can resend the code in {resendIn} s.</Help>
              ) : (
                <Help>
                  Didn’t get it?{' '}
                  <T
                    size={12.5}
                    color="accentText"
                    underline
                    accessibilityRole="link"
                    onPress={async () => {
                      await api.resendEmailCode(email.trim());
                      setResendIn(RESEND_SECONDS);
                    }}
                  >
                    Resend code
                  </T>
                </Help>
              )}
            </Field>
            <View style={{ gap: 10, marginTop: 24 }}>
              {codeOk ? (
                <Button as="a" label="Verify and continue" onPress={verify} loading={busy} />
              ) : (
                <Button label="Verify and continue" disabled disabledOpacity={0.45} />
              )}
              <Button
                label="Change email"
                variant="secondary"
                onPress={() => {
                  setCode('');
                  setStep('form');
                }}
              />
            </View>
            <Banner tone="info" icon="shield" style={{ marginTop: 24 }}>
              Next, you’ll verify your identity. It’s required before deposits, withdrawals, yield or borrowing.
            </Banner>
          </>
        )}
      </ScrollBody>
    </Screen>
  );
};
