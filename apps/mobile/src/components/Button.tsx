import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { T, type ColorToken } from './T';
import { slopFor } from './hitSlop';

export type ButtonVariant = 'primary' | 'secondary';
/** `.btn` heights in the design: 52 default, 48 Earn/Borrow, 40 ConnectWallet .btn-sm, 36 Profile .btn-sm. */
export type ButtonSize = 52 | 48 | 40 | 36;

type ButtonProps = {
  label: string;
  /**
   * The HTML element the design used. `.m button{font:inherit}` out-ranks `.btn`, so a design `<button class="btn">`
   * renders 14/400 while `<a class="btn">` renders 15/500. Reproduced exactly.
   */
  as?: 'button' | 'a';
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Text colour override, e.g. Sign out uses `neg`. */
  textColor?: ColorToken;
  disabled?: boolean;
  /** Opacity when disabled: .4 (`.btn[disabled]`) or .45 (CreateAccount inline). */
  disabledOpacity?: number;
  loading?: boolean;
  icon?: ReactNode;
  flex?: number;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const metrics: Record<ButtonSize, { ph: number; font: number; radius: number }> = {
  52: { ph: 18, font: 15, radius: 12 },
  48: { ph: 18, font: 15, radius: 12 },
  40: { ph: 18, font: 13.5, radius: 12 },
  36: { ph: 12, font: 13, radius: 10 },
};

/** `.btn` + `.btn-primary` / `.btn-secondary`. Pressed state within 100 ms; spinner while loading. */
export const Button = ({
  label,
  as = 'button',
  onPress,
  variant = 'primary',
  size = 52,
  textColor,
  disabled,
  disabledOpacity = 0.4,
  loading,
  icon,
  flex,
  block,
  style,
  accessibilityHint,
}: ButtonProps) => {
  const { c } = useTheme();
  const m = metrics[size];
  const primary = variant === 'primary';
  const fg = textColor ?? (primary ? 'onAccent' : 'text');
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={slopFor(size)}
      style={({ pressed }) => [
        {
          height: size,
          paddingHorizontal: m.ph,
          borderRadius: m.radius,
          borderWidth: 1,
          borderColor: primary ? 'transparent' : c.borderStrong,
          backgroundColor: primary ? c.accent : c.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? disabledOpacity : pressed ? 0.82 : 1,
        },
        flex !== undefined ? { flex } : null,
        block ? { alignSelf: 'stretch' } : null,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: loading ? 0 : 1 }}>
        {icon}
        <T size={as === 'a' ? m.font : 14} weight={as === 'a' ? 500 : 400} color={fg} numberOfLines={1}>
          {label}
        </T>
      </View>
      {loading ? <ActivityIndicator style={{ position: 'absolute' }} color={c[fg]} /> : null}
    </Pressable>
  );
};
