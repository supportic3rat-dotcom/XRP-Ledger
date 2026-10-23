import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { IconName } from '@xrp/tokens';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { T } from './T';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  markets: { label: 'Markets', icon: 'markets' },
  earn: { label: 'Earn', icon: 'earn' },
  borrow: { label: 'Borrow', icon: 'borrow' },
  profile: { label: 'Profile', icon: 'profile' },
};

/** `.tabbar` — 84 tall, padding 6/8/26, five equal tabs; current tab in accent-text with aria-current. */
export const TabBar = ({ state, navigation }: TabBarProps) => {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 84,
        paddingTop: 6,
        paddingHorizontal: 8,
        paddingBottom: 26,
        flexDirection: 'row',
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
    >
      {state.routes.map((route: { key: string; name: string }, index: number) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 10 }}
          >
            <Icon name={tab.icon} color={focused ? 'accentText' : 'text3'} />
            <T size={11} weight={500} color={focused ? 'accentText' : 'text3'}>
              {tab.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
};
