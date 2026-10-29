import { zodResolver } from '@hookform/resolvers/zod';
import { COUNTRIES, CURRENCY_NAMES, currencyForCountry } from '@xrp/ledger';
import { createAccountSchema, passwordRules, type CreateAccountInput } from '@xrp/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CheckRow, ErrorText, Field, Label, TextField } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { Screen, ScrollBody } from '@/components/Screen';
import { Select } from '@/components/Select';
import { StepBar } from '@/components/Steps';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useSession } from '@/state/session';

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
const CURRENCY_OPTIONS = Object.keys(CURRENCY_NAMES).map((code) => ({ value: code, label: code }));

export const CreateAccountScreen = () => {
  const router = useRouter();
  const setPendingEmail = useSession((s) => s.setPendingEmail);
  const setSignedIn = useSession((s) => s.setSignedIn);
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const form = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { name: '', email: '', password: '', country: '', currency: 'USD', terms: false as unknown as true, updates: false },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const password = form.watch('password');
  const country = form.watch('country');
  const rules = passwordRules(password);
  const errors = form.formState.errors;

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
      // No email code: the account is signed in as soon as it's created.
      setPendingEmail(values.email.trim());
      setSignedIn(true);
      router.replace('/verify');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'We couldn’t create your account. Try again.');
    } finally {
      setBusy(false);
    }
  });

  return (
    <Screen>
      <ScrollBody>
        <TopBar leading="back" label="Step 1 of 2 · Account" onLeading={() => router.back()} />
        <StepBar total={2} current={1} style={{ marginBottom: 24 }} />

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
                      placeholder="Select"
                      onChange={(code) => {
                        field.onChange(code);
                        // The country sets the currency values are shown in; they can still pick another.
                        form.setValue('currency', currencyForCountry(code));
                      }}
                      options={COUNTRY_OPTIONS}
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
                  render={({ field }) => <Select label="Display currency" height={48} value={field.value} onChange={field.onChange} options={CURRENCY_OPTIONS} />}
                />
              </Field>
            </View>
            {errors.country ? <ErrorText style={{ marginTop: -10 }}>{errors.country.message}</ErrorText> : null}
            {country ? (
              <T size={12.5} color="text3" style={{ marginTop: -8 }}>
                {`Values in the app will show in ${CURRENCY_NAMES[form.watch('currency')] ?? form.watch('currency')}. You can change this later in Profile.`}
              </T>
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
          <Banner tone="info" icon="shield" style={{ marginTop: 24 }}>
            Next, you’ll verify your identity. It’s required before deposits, withdrawals, yield or borrowing.
          </Banner>
        </>
      </ScrollBody>
    </Screen>
  );
};
