import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignOut } from '@/data/hooks';
import { useStaffSignOut } from '@/features/admin/hooks';
import { useStaff } from '@/features/admin/session';
import { biometricName, confirmWithDevice } from '@/lib/deviceAuth';
import { usePreferences } from '@/state/preferences';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { BrandMark } from './Icon';
import { T } from './T';

/** Away longer than this and the app asks again. Short enough to protect a phone left unlocked, long enough for a quick app switch. */
const RELOCK_AFTER_MS = 30_000;

const signedIn = () => useSession.getState().signedIn || !!useStaff.getState().session;

/** With app lock on, covers the app at launch and after time away until Face ID, fingerprint or the passcode confirms it's the owner. */
export const AppLock = () => {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const customerSignOut = useSignOut();
  const staffSignOut = useStaffSignOut();
  const [locked, setLocked] = useState(false);
  const [name, setName] = useState('Face ID or fingerprint');
  const leftAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await confirmWithDevice('Unlock XRP Ledger').catch(() => false);
    prompting.current = false;
    if (ok) setLocked(false);
  };

  // Launch: the stored preference may load a moment after the app does.
  useEffect(() => {
    const check = () => {
      if (usePreferences.getState().appLock && signedIn()) setLocked(true);
    };
    if (usePreferences.persist.hasHydrated()) check();
    else return usePreferences.persist.onFinishHydration(check);
    return undefined;
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') leftAt.current = Date.now();
      if (s !== 'active' || leftAt.current === null) return;
      const away = Date.now() - leftAt.current;
      leftAt.current = null;
      if (away >= RELOCK_AFTER_MS && usePreferences.getState().appLock && signedIn()) setLocked(true);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!locked) return;
    biometricName()
      .then((n) => n && setName(n))
      .catch(() => undefined);
    void unlock();
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!locked) return null;
  return (
    <View
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, paddingTop: insets.top + 120, paddingBottom: insets.bottom + 32, paddingHorizontal: 24 }]}
    >
      <View style={{ alignItems: 'center', gap: 14 }}>
        <BrandMark size={56} />
        <T size={22} weight={600} ls={-0.02} accessibilityRole="header">
          XRP Ledger is locked
        </T>
        <T lh={1.5} color="text2" align="center">{`Unlock with ${name} to continue.`}</T>
      </View>
      <View style={{ marginTop: 'auto', gap: 10 }}>
        <Button label="Unlock" onPress={() => void unlock()} />
        <Button
          label="Sign out"
          variant="secondary"
          onPress={async () => {
            setLocked(false);
            await (useStaff.getState().session ? staffSignOut() : customerSignOut());
          }}
        />
      </View>
    </View>
  );
};
