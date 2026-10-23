import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/theme';

/** `.m` frame: full-screen bg; content starts below the status bar. */
export const Screen = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => {
  const { c, scheme } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </View>
  );
};

type ScrollBodyProps = {
  children: ReactNode;
  /** `.scroll` padding: top 12 (8 on Home), bottom 32 / 108 (footer) / 112 (tab bar). */
  top?: number;
  bottom?: number;
  horizontal?: number;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
};

/** `.scroll` — absolute inset scroller with 16 side gutter. */
export const ScrollBody = ({ children, top = 12, bottom = 32, horizontal = 16, contentStyle, keyboard = true }: ScrollBodyProps) => {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps={keyboard ? 'handled' : 'never'}
      keyboardDismissMode="interactive"
      contentContainerStyle={[{ paddingTop: insets.top + top, paddingBottom: bottom, paddingHorizontal: horizontal }, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
};
