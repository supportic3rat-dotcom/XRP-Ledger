import { Redirect, Stack } from 'expo-router';
import { useLiveUpdates, useSignOut, useTrust } from '@/data/hooks';
import { useStaff } from '@/features/admin/session';
import { useAttachPendingWallets } from '@/lib/pendingWallets';
import { useIdleSignOut } from '@/lib/useIdleSignOut';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

/** Everything behind sign-in. Signed-out users are sent to Welcome, and customers without a trust to the trust form. */
export default function AppLayout() {
  const signedIn = useSession((s) => s.signedIn);
  const staff = useStaff((s) => s.session);
  const signOut = useSignOut();
  const { c } = useTheme();
  useLiveUpdates();
  useIdleSignOut(signedIn, signOut);
  useAttachPendingWallets(signedIn);
  const trust = useTrust();
  // A staff session reopened at launch starts here, not in the console.
  if (staff) return <Redirect href="/ops" />;
  if (!signedIn) return <Redirect href="/welcome" />;
  // Every account needs a crypto trust first (accounts made before trusts existed are asked to create one).
  if (trust.isSuccess && trust.data === null) return <Redirect href={{ pathname: '/trust', params: { from: 'existing' } }} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
