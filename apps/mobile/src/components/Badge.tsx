import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { T, type ColorToken } from './T';

export type BadgeTone = 'neutral' | 'muted' | 'ok' | 'okPos' | 'warn' | 'bad' | 'off';
type BadgeSize = 'sm' | 'md' | 'lg';

const SIZES: Record<BadgeSize, { h: number; ph: number; r: number; font: number }> = {
  sm: { h: 20, ph: 7, r: 6, font: 11 }, // Markets .tag
  md: { h: 22, ph: 8, r: 6, font: 11.5 }, // .badge, Deposit .tag
  lg: { h: 24, ph: 9, r: 7, font: 12 }, // LoanManage .badge, Withdraw .tag
};

/** `.badge` / `.tag`: compact label. neutral = sunken/text-2, muted = sunken/text-3, ok = accent-soft/accent-text, okPos = sunken/pos. */
export const Badge = ({ label, tone = 'neutral', size = 'md', style }: { label: string; tone?: BadgeTone; size?: BadgeSize; style?: StyleProp<ViewStyle> }) => {
  const { c } = useTheme();
  const s = SIZES[size];
  const map: Record<BadgeTone, [string, ColorToken]> = {
    neutral: [c.sunken, 'text2'],
    muted: [c.sunken, 'text3'],
    off: [c.sunken, 'text3'],
    ok: [c.accentSoft, 'accentText'],
    okPos: [c.sunken, 'pos'],
    warn: [c.warnSoft, 'warn'],
    bad: [c.negSoft, 'neg'],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[{ height: s.h, paddingHorizontal: s.ph, borderRadius: s.r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <T size={s.font} weight={500} color={fg} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
};

/** `.pill` — 30 tall on Home (15 radius), 26 on Profile (13 radius). */
export const Pill = ({ children, height = 30 }: { children: ReactNode; height?: 30 | 26 }) => {
  const { c } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height, paddingHorizontal: 10, borderRadius: height / 2, backgroundColor: c.accentSoft }}
    >
      {children}
    </View>
  );
};
