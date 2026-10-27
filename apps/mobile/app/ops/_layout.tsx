import { Redirect, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
import { useStaffSignOut } from '@/features/admin/hooks';
import { IDLE_LIMIT_MS, useStaff } from '@/features/admin/session';
import { useTheme } from '@/theme';

/** The staff console. Only a signed-in staff member gets here; 15 minutes idle (or in the background) signs them out. */
export default function OpsLayout() {
  const session = useStaff((s) => s.session);
  const signOut = useStaffSignOut();
  const { c } = useTheme();
  const last = useRef(Date.now());

  useEffect(() => {
    if (!session) return undefined;
    const check = () => {
      if (Date.now() - last.current > IDLE_LIMIT_MS) void signOut();
    };
    const timer = setInterval(check, 30_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [session, signOut]);

  if (!session) return <Redirect href="/sign-in" />;
  return (
    <View style={{ flex: 1 }} onTouchStart={() => (last.current = Date.now())}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </View>
  );
}
