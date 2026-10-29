import { zodResolver } from '@hookform/resolvers/zod';
import { resetSchema, signInSchema, type SignInInput } from '@xrp/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Linking, Pressable, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ErrorText, Field, Help, Label, TextField } from '@/components/Form';
import { HeroIcon } from '@/components/Glyph';
import { Screen, ScrollBody } from '@/components/Screen';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { passwordResetEmail, SUPPORT_EMAIL } from '@/lib/support';
import { resolveStaff, useStaff } from '@/features/admin/session';
import { useSession } from '@/state/session';

type View_ = 'signin' | 'forgot' | 'sent';

/** `.h1` 24/600 −0.02em and `.lead` 14/1.5 text-2. */
const H1 = ({ children }: { children: string }) => (
  <T size={24} weight={600} ls={-0.02} style={{ marginBottom: 6 }} accessibilityRole="header">
    {children}
  </T>
);
const Lead = ({ children, mb = 22 }: { children: React.ReactNode; mb?: number }) => (
  <T lh={1.5} color="text2" style={{ marginBottom: mb }}>
    {children}
  </T>
);

/** `.link` button on Sign in: underlined, 8/4 padding with matching negative margin; font inherits (14/400) like every design `<button>`. */
const InlineLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable accessibilityRole="link" onPress={onPress} style={{ paddingVertical: 8, paddingHorizontal: 4, marginVertical: -8, marginHorizontal: -4 }}>
    <T color="text" underline>
      {label}
    </T>
  </Pressable>
);

export const SignInScreen = () => {
  const router = useRouter();
  const setSignedIn = useSession((s) => s.setSignedIn);
  const setStaffSession = useStaff((s) => s.setSession);
  const [view, setView] = useState<View_>('signin');
  const [showPass, setShowPass] = useState(false);
  const [bad, setBad] = useState<{ attemptsLeft: number; locked: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const email = form.watch('email');

  const submit = form.handleSubmit(async ({ email: e, password }) => {
    setBusy(true);
    const r = await api.signIn(e.trim(), password);
    if (r.status !== 'ok') {
      setBusy(false);
      setBad({ attemptsLeft: r.attemptsLeft, locked: r.locked });
      return;
    }
    // Staff accounts open the operations console; everyone else opens their wallet.
    const staff = await resolveStaff(e).catch(() => null);
    setBusy(false);
    if (staff) {
      setStaffSession(staff);
      router.replace('/ops');
      return;
    }
    setSignedIn(true);
    router.replace('/');
  });

  /** No email service: the request goes to support from the customer's own mail app, which proves they own the address. */
  const sendReset = async () => {
    const ok = resetSchema.safeParse({ email }).success;
    if (!ok) {
      form.setError('email', { message: 'Enter the email you signed up with.' });
      return;
    }
    setBusy(true);
    await Linking.openURL(passwordResetEmail(email.trim()))
      .catch(() => undefined)
      .finally(() => setBusy(false));
    setView('sent');
  };

  const back = () => {
    form.clearErrors();
    setView('signin');
  };

  const emailField = (id: string) => (
    <Field>
      <Label nativeID={id}>Email</Label>
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <>
            <TextField
              accessibilityLabelledBy={id}
              value={field.value}
              onChangeText={(v) => field.onChange(v.trim())}
              onBlur={field.onBlur}
              invalid={!!fieldState.error}
              height={null}
              minHeight={52}
              style={{ height: 50 }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
            />
            <ErrorText>{fieldState.error?.message}</ErrorText>
          </>
        )}
      />
    </Field>
  );

  return (
    <Screen>
      <ScrollBody>
        <TopBar leading="back" leadingLabel="Back" onLeading={view === 'signin' ? () => router.replace('/welcome') : back} />

        {view === 'signin' ? (
          <>
            <H1>Welcome back</H1>
            <Lead>Sign in to your custodial account.</Lead>
            {bad ? (
              <Banner tone="error" icon="alert" alert style={{ marginBottom: 16 }}>
                {bad.locked
                  ? 'Too many attempts. Sign-in is locked for 15 minutes. Contact support if you can’t get in.'
                  : `That email and password don’t match. ${bad.attemptsLeft} attempts left before a 15-minute lock.`}
              </Banner>
            ) : null}
            <View style={{ gap: 16 }}>
              {emailField('si-email')}
              <Field>
                <Label nativeID="si-pass">Password</Label>
                <Controller
                  control={form.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <>
                      <TextField
                        accessibilityLabelledBy="si-pass"
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={field.onBlur}
                        invalid={!!fieldState.error}
                        height={null}
                        minHeight={52}
                        style={{ height: 50 }}
                        secureTextEntry={!showPass}
                        autoComplete="current-password"
                        textContentType="password"
                        returnKeyType="go"
                        onSubmitEditing={() => submit()}
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
                      <ErrorText>{fieldState.error?.message}</ErrorText>
                    </>
                  )}
                />
              </Field>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: -4 }}>
                <InlineLink label="Forgot password?" onPress={() => setView('forgot')} />
              </View>
              <Button label="Sign in" onPress={submit} loading={busy} disabled={bad?.locked} />
            </View>
            {bad?.locked ? (
              <Help align="center" style={{ marginTop: 16 }}>
                Locked out?{' '}
                <T size={12.5} color="accentText" onPress={() => router.push('/support')} accessibilityRole="link">
                  Contact support
                </T>
              </Help>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 }}>
              <T size={13.5} color="text2">
                New here?
              </T>
              <T size={13.5} weight={500} color="accentText" underline accessibilityRole="link" onPress={() => router.replace({ pathname: '/trust', params: { from: 'create' } })}>
                Create an account
              </T>
            </View>
          </>
        ) : null}

        {view === 'forgot' ? (
          <>
            <H1>Reset your password</H1>
            <Lead>{`Email our support team from the address on your account. We’ll check it’s you and email you a new password.`}</Lead>
            {emailField('fp-email')}
            <Button label="Email support" onPress={sendReset} loading={busy} style={{ marginTop: 18 }} />
            <Help style={{ marginTop: 12, marginHorizontal: 4 }}>
              {`This opens your email app with a message to ${SUPPORT_EMAIL}. Send it from the email you signed up with.`}
            </Help>
            <Banner tone="warn" icon="shield" style={{ marginTop: 18 }}>
              For your security, withdrawals are paused for 24 hours after a password reset. Your balances aren’t affected.
            </Banner>
          </>
        ) : null}

        {view === 'sent' ? (
          <>
            <View style={{ marginBottom: 14 }}>
              <HeroIcon icon="mail" tone="ok" size={52} />
            </View>
            <H1>Send the email to support</H1>
            <Lead>
              Once your email reaches{' '}
              <T weight={600} color="text2">
                {SUPPORT_EMAIL}
              </T>
              , we’ll reply to{' '}
              <T weight={600} color="text2">
                {email}
              </T>{' '}
              with a new password, usually within one business day. Sign in with it, then choose your own in Security.
            </Lead>
            <View style={{ gap: 10 }}>
              <Button label="Back to sign in" onPress={back} />
              <Button label="Open the email again" variant="secondary" onPress={() => void Linking.openURL(passwordResetEmail(email.trim())).catch(() => undefined)} />
            </View>
            <Help style={{ marginTop: 20, marginHorizontal: 4 }}>
              {`Email app not opening? Write to ${SUPPORT_EMAIL} from the email on your account, with the subject “Password reset request”. We’ll never ask for your old password.`}
            </Help>
          </>
        ) : null}
      </ScrollBody>
    </Screen>
  );
};
