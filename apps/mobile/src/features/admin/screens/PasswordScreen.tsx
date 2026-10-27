import { changePasswordSchema } from '@xrp/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ErrorText, Field, Help, Label, TextField } from '@/components/Form';
import { useOpsAction, useStaffSession } from '../hooks';
import { OpsScreen } from '../ui';

/** A staff member changes their own password. The server checks the current one and signs out other devices. */
export const PasswordScreen = () => {
  const router = useRouter();
  const { data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '', tried: false });
  const [error, setError] = useState('');
  const parsed = changePasswordSchema.safeParse(pw);
  const err = (path: string) => (pw.tried && !parsed.success ? (parsed.error.issues.find((i) => i.path[0] === path)?.message ?? '') : '');

  const save = async () => {
    if (!parsed.success) {
      setPw((s) => ({ ...s, tried: true }));
      return;
    }
    setError('');
    const r = await run(() => data.changePassword(pw.current, pw.next));
    if (r.ok) router.back();
    else setError(r.error);
  };

  const field = (key: 'current' | 'next' | 'confirm', label: string, auto: 'current-password' | 'new-password') => (
    <Field>
      <Label nativeID={`spw-${key}`}>{label}</Label>
      <TextField
        accessibilityLabelledBy={`spw-${key}`}
        height={48}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={auto}
        textContentType={auto === 'current-password' ? 'password' : 'newPassword'}
        value={pw[key]}
        onChangeText={(v) => setPw((s) => ({ ...s, [key]: v }))}
        invalid={!!err(key)}
      />
      {key === 'next' ? <Help>12+ characters with a number and upper and lower case.</Help> : null}
      <ErrorText>{err(key)}</ErrorText>
    </Field>
  );

  return (
    <OpsScreen title="Change password" sub="Use a long password you don’t use anywhere else." backLabel="Back to More">
      <View style={{ gap: 14 }}>
        {field('current', 'Current password', 'current-password')}
        {field('next', 'New password', 'new-password')}
        {field('confirm', 'Confirm new password', 'new-password')}
      </View>
      {error ? (
        <Banner tone="error" alert>
          {error}
        </Banner>
      ) : null}
      <Banner tone="warn">Other devices signed in to this account will be signed out.</Banner>
      <Button label="Update password" loading={pending} onPress={() => void save()} />
    </OpsScreen>
  );
};
