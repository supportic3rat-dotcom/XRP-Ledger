import type { MobileColors } from '@xrp/tokens';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { familyFor, useTheme, type Weight } from '@/theme';

export type ColorToken = keyof MobileColors;

export type TProps = TextProps & {
  size?: number;
  weight?: Weight;
  color?: ColorToken;
  /** Raw colour override, only for values derived from tokens. */
  rawColor?: string;
  /** CSS line-height multiplier (the frame default is 1.4). */
  lh?: number;
  /** CSS letter-spacing in em. */
  ls?: number;
  mono?: boolean;
  num?: boolean;
  align?: TextStyle['textAlign'];
  underline?: boolean;
};

/** Text with the design's type rules: Geist, 14/1.4 default, tabular figures on request. */
export const T = ({ size = 14, weight = 400, color = 'text', rawColor, lh = 1.4, ls, mono, num, align, underline, style, ...rest }: TProps) => {
  const { c } = useTheme();
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[
        {
          fontFamily: familyFor(weight, mono),
          fontSize: size,
          lineHeight: size * lh,
          color: rawColor ?? c[color],
          ...(ls !== undefined ? { letterSpacing: ls * size } : null),
          ...(num ? { fontVariant: ['tabular-nums'] } : null),
          ...(align ? { textAlign: align } : null),
          ...(underline ? { textDecorationLine: 'underline' } : null),
        },
        style,
      ]}
    />
  );
};
