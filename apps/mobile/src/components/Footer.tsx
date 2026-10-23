import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';

/** `.footer` — fixed bottom bar: padding 12/16/28, bg, top border, buttons share the row. */
export const Footer = ({ children }: { children: ReactNode }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        gap: 10,
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 28,
        backgroundColor: c.bg,
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
    >
      {children}
    </View>
  );
};
