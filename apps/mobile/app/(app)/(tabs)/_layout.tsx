import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/theme';

/** Five tabs; pushed screens (siblings in the (app) stack) hide the bar. */
export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="markets" />
      <Tabs.Screen name="earn" />
      <Tabs.Screen name="borrow" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
