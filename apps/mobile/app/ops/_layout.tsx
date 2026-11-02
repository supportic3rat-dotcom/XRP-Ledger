import { Redirect, Stack } from 'expo-router';
import { useStaffSignOut } from '@/features/admin/hooks';
import { IdentityAlerts } from '@/features/admin/IdentityAlerts';
import { useStaff } from '@/features/admin/session';
import { useIdleSignOut } from '@/lib/useIdleSignOut';
import { useTheme } from '@/theme';

/** The staff console. Only a signed-in staff member gets here; 15 minutes without use (open or closed) signs them out. */
export default function OpsLayout() {
  const session = useStaff((s) => s.session);
  const signOut = useStaffSignOut();
  const { c } = useTheme();
  useIdleSignOut(!!session, signOut);

  if (!session) return <Redirect href="/sign-in" />;
  return (
    <>
      <IdentityAlerts />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </>
  );
}
