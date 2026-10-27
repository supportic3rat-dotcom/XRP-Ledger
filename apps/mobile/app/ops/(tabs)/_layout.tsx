import { Tabs } from 'expo-router';
import { OpsTabBar } from '@/features/admin/OpsTabBar';
import { useTheme } from '@/theme';

/** Overview, Queue, Transactions, Users, More; detail pages are pushed over the tabs. */
export default function OpsTabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs tabBar={(props) => <OpsTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="queue" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="users" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
