import type { IconName } from '@xrp/tokens';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { T } from './T';

export type BannerTone = 'info' | 'warn' | 'error';

/** `.banner` — icon + one or two sentences. info: sunken/text-2, warn: warn-soft/warn, error: neg-soft/neg. */
export const Banner = ({
  tone = 'info',
  icon,
  children,
  trailing,
  style,
  alert,
  size = 13,
  padding,
}: {
  tone?: BannerTone;
  icon?: IconName | null;
  children: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  alert?: boolean;
  size?: number;
  padding?: { v: number; h: number };
}) => {
  const { c } = useTheme();
  const bg = tone === 'warn' ? c.warnSoft : tone === 'error' ? c.negSoft : c.sunken;
  const fg = tone === 'warn' ? 'warn' : tone === 'error' ? 'neg' : 'text2';
  return (
    <View
      accessibilityRole={alert ? 'alert' : undefined}
      style={[
        {
          flexDirection: 'row',
          gap: 10,
          alignItems: 'flex-start',
          paddingVertical: padding?.v ?? 12,
          paddingHorizontal: padding?.h ?? 14,
          borderRadius: 12,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size="sm" color={fg} style={{ marginTop: 1 }} /> : null}
      {typeof children === 'string' ? (
        <T size={size} lh={1.45} color={fg} style={{ flex: 1 }}>
          {children}
        </T>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {trailing}
    </View>
  );
};
