import { Redirect, Stack } from 'expo-router';
import { useLiveUpdates } from '@/data/hooks';
import { useAttachPendingWallets } from '@/lib/pendingWallets';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

/** Everything behind sign-in. Signed-out users are sent to Welcome; live updates run while signed in. */
export default function AppLayout() {
  const signedIn = useSession((s) => s.signedIn);
  const { c } = useTheme();
  useLiveUpdates();
  useAttachPendingWallets(signedIn);
  if (!signedIn) return <Redirect href="/welcome" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
