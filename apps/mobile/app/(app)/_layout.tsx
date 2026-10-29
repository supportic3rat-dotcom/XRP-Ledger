import { Redirect, Stack } from 'expo-router';
import { useLiveUpdates, useTrust } from '@/data/hooks';
import { useAttachPendingWallets } from '@/lib/pendingWallets';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

/** Everything behind sign-in. Signed-out users are sent to Welcome, and customers without a trust to the trust form. */
export default function AppLayout() {
  const signedIn = useSession((s) => s.signedIn);
  const { c } = useTheme();
  useLiveUpdates();
  useAttachPendingWallets(signedIn);
  const trust = useTrust();
  if (!signedIn) return <Redirect href="/welcome" />;
  // Every account needs a crypto trust first (accounts made before trusts existed are asked to create one).
  if (trust.isSuccess && trust.data === null) return <Redirect href={{ pathname: '/trust', params: { from: 'existing' } }} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
