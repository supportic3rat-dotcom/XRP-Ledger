import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { useTheme } from '@/theme';
import type { CheckTone, JournalRow, TimelineRow } from './data/types';
import { useStaffSession } from './hooks';

/** Environment pill from the console header: sample data in demo mode, otherwise the network. */
export const EnvPill = () => {
  const { data } = useStaffSession();
  const { c } = useTheme();
  const label =
    data.mode === 'demo'
      ? 'Demo · sample data'
      : `${process.env.EXPO_PUBLIC_ENV_LABEL ?? 'Live'} · XRPL ${process.env.EXPO_PUBLIC_XRPL_NETWORK ?? 'mainnet'}`;
  return (
    <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: c.warnSoft }}>
      <T size={11.5} weight={500} color="warn">
        {label}
      </T>
    </View>
  );
};

type OpsScreenProps = {
  title: string;
  sub?: string;
  children: ReactNode;
  /** Tab screens have no back button and leave room for the tab bar. */
  tab?: boolean;
  backLabel?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
};

/** A console page: title, one-line purpose, environment pill, pull to refresh. */
export const OpsScreen = ({ title, sub, children, tab, backLabel = 'Back', refreshing = false, onRefresh }: OpsScreenProps) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { c } = useTheme();
  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingTop: insets.top + (tab ? 20 : 12), paddingBottom: tab ? 112 : 40, paddingHorizontal: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.text3} /> : undefined}
      >
        {tab ? null : <TopBar leadingLabel={backLabel} marginBottom={0} onLeading={() => (router.canGoBack() ? router.back() : router.replace('/ops'))} />}
        <View style={{ gap: 6, marginHorizontal: 4 }}>
          <T size={24} weight={600} ls={-0.02} accessibilityRole="header">
            {title}
          </T>
          {sub ? (
            <T size={13.5} lh={1.45} color="text2">
              {sub}
            </T>
          ) : null}
          <EnvPill />
        </View>
        {children}
      </ScrollView>
    </Screen>
  );
};

/** Loading, error and retry for a console read. */
export const Loading = ({ error, onRetry }: { error?: unknown; onRetry?: () => void }) =>
  error ? (
    <Banner tone="error" icon="alert" alert>
      <T size={13} lh={1.45} color="neg">
        {error instanceof Error ? error.message : 'Couldn’t load this page.'}
      </T>
      {onRetry ? <Button label="Try again" variant="secondary" size={36} onPress={onRetry} style={{ marginTop: 10, alignSelf: 'flex-start' }} /> : null}
    </Banner>
  ) : (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );

/** Section heading inside a card (`.sec-t`). */
export const SecT = ({ children, top = 0 }: { children: ReactNode; top?: number }) => (
  <T size={13} weight={600} color="text2" accessibilityRole="header" style={{ marginTop: top, marginBottom: 8 }}>
    {children}
  </T>
);

/** Padded card body for detail sections. */
export const Panel = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 16, gap: 16 }, style]}>{children}</View>;
};

/** Horizontal filter tabs with counts (`.tabs`). */
export const FilterTabs = <K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) => {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={label} contentContainerStyle={{ gap: 6 }} style={{ marginHorizontal: -16 }}>
      <View style={{ width: 10 }} />
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 34,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: on ? c.text : c.border,
              backgroundColor: on ? c.text : c.surface,
            }}
          >
            <T size={13} weight={500} rawColor={on ? c.bg : c.text}>
              {o.label}
            </T>
            {o.count !== undefined ? (
              <T size={12} num rawColor={on ? c.bg : c.text3}>
                {String(o.count)}
              </T>
            ) : null}
          </Pressable>
        );
      })}
      <View style={{ width: 10 }} />
    </ScrollView>
  );
};

const CHECK_ICON = { ok: 'check', warn: 'alertPath', wait: 'clockPath', bad: 'xCircle' } as const;
const CHECK_COLOR = { ok: 'pos', warn: 'warn', wait: 'text3', bad: 'neg' } as const;

/** One row of a Checks list: icon by outcome, label, note. */
export const CheckRow = ({ label, note, tone, first }: { label: string; note: string; tone: CheckTone; first?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 9, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <Icon name={CHECK_ICON[tone]} size="sm" color={CHECK_COLOR[tone]} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 1 }}>
        <T size={13.5} weight={500}>
          {label}
        </T>
        {note ? (
          <T size={12} lh={1.4} color="text3">
            {note}
          </T>
        ) : null}
      </View>
    </View>
  );
};

/** Plain bordered line for lists inside a panel (flags, signers, providers). */
export const Line = ({ children, first, style }: { children: ReactNode; first?: boolean; style?: StyleProp<ViewStyle> }) => {
  const { c } = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }, style]}>{children}</View>;
};

/** Debit / credit journal as a three-column table. */
export const Journal = ({ rows }: { rows: JournalRow[] }) => {
  const { c } = useTheme();
  return (
    <View accessibilityRole="none">
      <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 6 }}>
        <T size={11.5} color="text3" style={{ flex: 2 }}>
          Account
        </T>
        <T size={11.5} color="text3" align="right" style={{ flex: 1 }}>
          Debit
        </T>
        <T size={11.5} color="text3" align="right" style={{ flex: 1 }}>
          Credit
        </T>
      </View>
      {rows.map((j, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.border }}>
          <T size={12.5} style={{ flex: 2 }}>
            {j.account}
          </T>
          <T size={12.5} num align="right" style={{ flex: 1 }}>
            {j.dr}
          </T>
          <T size={12.5} num align="right" style={{ flex: 1 }}>
            {j.cr}
          </T>
        </View>
      ))}
    </View>
  );
};

/** Time-stamped audit trail. */
export const Timeline = ({ rows }: { rows: TimelineRow[] }) => (
  <View style={{ gap: 8 }}>
    {rows.map((e, i) => (
      <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
        <T size={12} mono color="text3" style={{ width: 44 }}>
          {e.at}
        </T>
        <T size={13} lh={1.4} style={{ flex: 1 }}>
          {e.text}
        </T>
      </View>
    ))}
  </View>
);

/** Small note under a disabled action explaining why. */
export const BlockNote = ({ children }: { children: string }) =>
  children ? (
    <T size={12} lh={1.4} color="text3">
      {children}
    </T>
  ) : null;

/** Centered empty-state line inside a list card. */
export const Empty = ({ children }: { children: string }) => (
  <T size={13} color="text3" align="center" style={{ paddingVertical: 28, paddingHorizontal: 16 }}>
    {children}
  </T>
);
