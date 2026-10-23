import type { IconName } from '@xrp/tokens';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { T } from './T';

/** `.glyph` — asset initial in a circle (inverted), or muted for unsupported assets. */
export const Glyph = ({
  char,
  size = 36,
  font = 15,
  muted,
  mutedColor = 'text3',
  accent,
}: {
  char: string;
  size?: number;
  font?: number;
  muted?: boolean;
  mutedColor?: 'text2' | 'text3';
  accent?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: muted ? c.sunken : accent ? c.accent : c.text,
      }}
    >
      <T size={font} weight={600} rawColor={muted ? c[mutedColor] : accent ? c.onAccent : c.bg}>
        {char}
      </T>
    </View>
  );
};

export type HeroTone = 'ok' | 'wait' | 'bad' | 'off';

/** `.hero-ic` 56px/16r (Verify, done states) and `.hero` 52px/14r (sign-in steps). */
export const HeroIcon = ({
  icon,
  d,
  tone = 'ok',
  size = 52,
  iconSize = 24,
}: {
  icon?: IconName;
  d?: string;
  tone?: HeroTone;
  size?: 52 | 56;
  iconSize?: number;
}) => {
  const { c } = useTheme();
  const bg = tone === 'ok' ? c.accentSoft : tone === 'wait' ? c.warnSoft : tone === 'bad' ? c.negSoft : c.sunken;
  const fg = tone === 'ok' ? 'accentText' : tone === 'wait' ? 'warn' : tone === 'bad' ? 'neg' : 'text2';
  return (
    <View style={{ width: size, height: size, borderRadius: size === 56 ? 16 : 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon {...(icon ? { name: icon } : {})} {...(d ? { d } : {})} size={iconSize} color={fg} />
    </View>
  );
};
