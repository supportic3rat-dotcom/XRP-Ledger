import type { AppNotification } from '@xrp/types';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Segmented } from '@/components/Segmented';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useApiMutation, useNotifications } from '@/data/hooks';
import { hm, isSameDay, md } from '@/lib/dates';
import { useTheme } from '@/theme';

type Filter = 'all' | 'tx' | 'security';
const ICONS: Record<AppNotification['icon'], Parameters<typeof Icon>[0]['name']> = {
  recv: 'recv',
  shield: 'shield',
  coin: 'plus',
  alert: 'alertPath',
  doc: 'doc',
  ex: 'exchange',
  clock: 'clockPath',
};

const NoteIcon = ({ n }: { n: AppNotification }) => {
  const { c } = useTheme();
  const bg = n.tone === 'warn' ? c.warnSoft : n.tone === 'bad' ? c.negSoft : c.sunken;
  const fg = n.tone === 'ok' ? 'pos' : n.tone === 'warn' ? 'warn' : n.tone === 'bad' ? 'neg' : 'text2';
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={ICONS[n.icon]} size="sm" color={fg} />
    </View>
  );
};

export const NotificationsScreen = () => {
  const router = useRouter();
  const { c } = useTheme();
  const notes = useNotifications();
  const markRead = useApiMutation((ids?: string[]) => api.markNotificationsRead(ids));
  const [filter, setFilter] = useState<Filter>('all');
  const now = api.now();
  const list = (notes.data ?? []).filter((n) => filter === 'all' || n.type === filter || (filter === 'security' && n.type === 'account'));
  const groups = [
    { label: 'Today', items: list.filter((n) => isSameDay(n.createdAt, now)) },
    { label: 'Earlier', items: list.filter((n) => !isSameDay(n.createdAt, now)) },
  ].filter((g) => g.items.length);
  const noUnread = (notes.data ?? []).every((n) => n.readAt);

  const open = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate([n.id]);
    router.push(n.link as Href);
  };

  return (
    <Screen>
      <ScrollBody>
        <TopBar
          title="Notifications"
          leadingLabel="Back to Home"
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: noUnread }}
              disabled={noUnread}
              onPress={() => markRead.mutate(undefined)}
              style={{ paddingVertical: 10, paddingHorizontal: 6, marginRight: -6 }}
            >
              <T color={noUnread ? 'text3' : 'text'}>Read all</T>
            </Pressable>
          }
        />
        <Segmented
          label="Filter notifications"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'tx', label: 'Activity' },
            { value: 'security', label: 'Security' },
          ]}
        />
        {groups.map((g) => (
          <View key={g.label}>
            <Sec top={20}>{g.label}</Sec>
            <Card>
              {g.items.map((n, i) => {
                const unread = !n.readAt;
                return (
                  <Pressable
                    key={n.id}
                    accessibilityRole="link"
                    accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}`}
                    onPress={() => open(n)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: c.border,
                      backgroundColor: pressed ? c.sunken : 'transparent',
                    })}
                  >
                    <NoteIcon n={n} />
                    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                      <T weight={unread ? 600 : 500}>{n.title}</T>
                      <T size={13} lh={1.45} color="text2">
                        {n.body}
                      </T>
                      <T size={12} color="text3">
                        {isSameDay(n.createdAt, now) ? hm(n.createdAt) : md(n.createdAt)}
                      </T>
                    </View>
                    {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.neg, marginTop: 6 }} /> : null}
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ))}
        {groups.length === 0 && !notes.isLoading ? (
          <T size={13.5} color="text3" align="center" style={{ paddingVertical: 40, paddingHorizontal: 16 }}>
            Nothing here yet.
          </T>
        ) : null}
        <T size={12} lh={1.5} color="text3" style={{ marginTop: 20, marginHorizontal: 4 }}>
          Tap a notification to open the related screen. Notifications never include your full address, balances or codes.
        </T>
      </ScrollBody>
    </Screen>
  );
};
