import type { Tone } from '@xrp/types';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { T, type ColorToken } from './T';

/** `.status` — 6px dot + label; colour is never the only signal. */
export const Status = ({ tone, label, size = 12, base = 'text2' }: { tone: Tone | ''; label: string; size?: number; base?: ColorToken }) => {
  const { c } = useTheme();
  const color: ColorToken = tone === 'ok' ? 'pos' : tone === 'wait' ? 'warn' : tone === 'bad' ? 'neg' : tone === 'off' ? 'text3' : base;
  const dot = tone === 'wait' ? c.dotWarn : c[color];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
      <T size={size} weight={500} color={color} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
};
