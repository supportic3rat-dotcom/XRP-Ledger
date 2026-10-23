import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

/** `.card` — surface, 1px border, 12 radius. */
export const Card = ({ children, style, clip = true }: { children?: ReactNode; style?: StyleProp<ViewStyle>; clip?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12 }, clip ? { overflow: 'hidden' } : null, style]}>
      {children}
    </View>
  );
};
