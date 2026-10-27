import type { Tabs } from 'expo-router';
import type { IconName } from '@xrp/tokens';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { T } from '@/components/T';
import { useTheme } from '@/theme';
import { queueStatus } from './data/status';
import { useOps } from './hooks';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Overview', icon: 'adminOverview' },
  queue: { label: 'Queue', icon: 'adminQueue' },
  transactions: { label: 'Transactions', icon: 'exchange' },
  users: { label: 'Users', icon: 'adminUsers' },
  more: { label: 'More', icon: 'grid' },
};

/** The console's tab bar: same look as the wallet's, with the number of requests waiting on the Queue tab. */
export const OpsTabBar = ({ state, navigateToTab }: TabBarProps) => {
  const { c } = useTheme();
  const queue = useOps('queue', (d) => d.queue());
  const waiting = (queue.data ?? []).filter((q) => queueStatus(q)[1] === 'wait').length;
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
        const count = route.name === 'queue' ? waiting : 0;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={count ? `${tab.label}, ${count} waiting` : tab.label}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 10 }}
          >
            <View>
              <Icon name={tab.icon} color={focused ? 'accentText' : 'text3'} />
              {count ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -12,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: 9,
                    backgroundColor: c.warn,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <T size={10.5} weight={600} rawColor={c.bg} num>
                    {String(count)}
                  </T>
                </View>
              ) : null}
            </View>
            <T size={11} weight={500} color={focused ? 'accentText' : 'text3'} numberOfLines={1}>
              {tab.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
};
