import { forwardRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { familyFor, useTheme } from '@/theme';
import { Icon } from './Icon';
import { T } from './T';

/** `.field` — label, control, help/error stacked with 6px gap. */
export const Field = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[{ gap: 6 }, style]}>{children}</View>;

/** `.label` — 13/500. */
export const Label = ({ children, nativeID, optional }: { children: ReactNode; nativeID?: string; optional?: boolean }) => (
  <T size={13} weight={500} nativeID={nativeID}>
    {children}
    {optional ? (
      <T size={13} color="text3">
        {' '}
        · optional
      </T>
    ) : null}
  </T>
);

/** `.help` — 12.5 text-3, 1.45. */
export const Help = ({ children, align, style }: { children: ReactNode; align?: 'center' | 'left'; style?: object }) => (
  <T size={12.5} lh={1.45} color="text3" align={align} style={style}>
    {children}
  </T>
);

/** `.err` — 12.5 neg, announced as an alert. */
export const ErrorText = ({ children, style }: { children: ReactNode; style?: object }) =>
  children ? (
    <T size={12.5} lh={1.45} color="neg" accessibilityRole="alert" accessibilityLiveRegion="polite" style={style}>
      {children}
    </T>
  ) : null;

type WrapProps = {
  children: ReactNode;
  focused?: boolean;
  invalid?: boolean;
  /** `.input-wrap` height: 48 / 50 (min) / 52 / 56 / 64, or null for content height (textarea). */
  height?: number | null;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
};

/** `.input-wrap` — 1px border-strong, 12 radius; focus = accent border + 3px accent-soft ring; invalid = neg border. */
export const InputWrap = ({ children, focused, invalid, height = 52, minHeight, style }: WrapProps) => {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderRadius: 12,
          backgroundColor: c.surface,
          borderColor: invalid ? c.neg : focused ? c.accent : c.borderStrong,
          ...(height !== null ? { height } : {}),
          ...(minHeight ? { minHeight } : {}),
        },
        style,
      ]}
    >
      {focused ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 15, borderWidth: 3, borderColor: c.accentSoft }}
        />
      ) : null}
      {children}
    </View>
  );
};

export type InputProps = TextInputProps & {
  /** Font size inside the field: 15 default, 14, 16 (Earn/Borrow), 22, 26 (amounts). */
  size?: number;
  weight?: 400 | 500;
  mono?: boolean;
  num?: boolean;
  letterSpacingEm?: number;
};

/** Text input styled to sit inside `InputWrap`. */
export const Input = forwardRef<ComponentRef<typeof TextInput>, InputProps>(({ size = 15, weight = 400, mono, num, letterSpacingEm, style, ...rest }, ref) => {
  const { c } = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={c.placeholder}
      selectionColor={c.accent}
      cursorColor={c.accent}
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[
        {
          flex: 1,
          minWidth: 0,
          alignSelf: 'stretch',
          padding: 0,
          fontSize: size,
          fontFamily: familyFor(weight, mono),
          color: c.text,
          ...(num ? { fontVariant: ['tabular-nums'] as const } : null),
          ...(letterSpacingEm ? { letterSpacing: letterSpacingEm * size } : null),
        },
        { outlineStyle: 'none' } as object,
        style,
      ]}
    />
  );
});
Input.displayName = 'Input';

type TextFieldProps = InputProps & {
  invalid?: boolean;
  height?: number | null;
  minHeight?: number;
  leading?: ReactNode;
  trailing?: ReactNode;
  wrapStyle?: StyleProp<ViewStyle>;
};

/** Input + wrap with its own focus state. */
export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(
  ({ invalid, height = 52, minHeight, leading, trailing, wrapStyle, onFocus, onBlur, ...input }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <InputWrap focused={focused} invalid={invalid} height={height} minHeight={minHeight} style={wrapStyle}>
        {leading}
        <Input
          ref={ref}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {trailing}
      </InputWrap>
    );
  },
);
TextField.displayName = 'TextField';

/**
 * `.otp` — 60 tall, centred, 0.4em tracking. The design's `.otp`/`.mono` classes lose to `.m input{font:inherit}`,
 * so the code renders in 14px Geist (reproduced exactly). Accepts paste; strips non-allowed characters.
 */
export const OtpInput = ({
  value,
  onChange,
  length = 6,
  invalid,
  alphanumeric,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  invalid?: boolean;
  alphanumeric?: boolean;
  label: string;
}) => {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const clean = (v: string) =>
    alphanumeric
      ? v
          .toUpperCase()
          .replace(/[^A-Z0-9-]/g, '')
          .slice(0, length + 1)
      : v.replace(/\D/g, '').slice(0, length);
  return (
    <View>
      {focused ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 15, borderWidth: 3, borderColor: c.accentSoft }}
        />
      ) : null}
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={(v) => onChange(clean(v))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={alphanumeric ? 'default' : 'number-pad'}
        autoCapitalize="characters"
        autoCorrect={false}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={alphanumeric ? length + 1 : length}
        placeholder={alphanumeric ? '····-····' : '······'}
        placeholderTextColor={c.placeholder}
        selectionColor={c.accent}
        style={[
          {
            height: 60,
            borderWidth: 1,
            borderRadius: 12,
            borderColor: invalid ? c.neg : focused ? c.accent : c.borderStrong,
            backgroundColor: c.surface,
            textAlign: 'center',
            fontSize: 14,
            letterSpacing: 14 * 0.4,
            fontFamily: familyFor(400),
            color: c.text,
            paddingLeft: 14 * 0.4,
          },
          { outlineStyle: 'none' } as object,
        ]}
      />
    </View>
  );
};

/** Native checkbox look from the design (browser default box with accent fill when checked). */
export const Checkbox = ({ checked, size = 20 }: { checked: boolean; size?: number }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        borderWidth: checked ? 0 : 1,
        borderColor: c.checkboxBorder,
        backgroundColor: checked ? c.accent : c.checkboxFill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Icon name="check" size={size - 4} rawColor={c.onAccent} strokeWidth={3} /> : null}
    </View>
  );
};

/** `.check` — checkbox + label, 13.5/1.45, gap 10. */
export const CheckRow = ({
  checked,
  onChange,
  children,
  color = 'text',
  size = 20,
  style,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  color?: 'text' | 'text2';
  size?: number;
  style?: StyleProp<ViewStyle>;
}) => (
  <Pressable
    accessibilityRole="checkbox"
    accessibilityState={{ checked }}
    onPress={() => onChange(!checked)}
    style={[{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, style]}
  >
    <Checkbox checked={checked} size={size} />
    {typeof children === 'string' ? (
      <T size={13.5} lh={1.45} color={color} style={{ flex: 1 }}>
        {children}
      </T>
    ) : (
      <View style={{ flex: 1 }}>{children}</View>
    )}
  </Pressable>
);

/** `.radio` — 20px ring, 2px border-strong; selected = 6px accent border. */
export const Radio = ({ on }: { on: boolean }) => {
  const { c } = useTheme();
  return <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: on ? 6 : 2, borderColor: on ? c.accent : c.borderStrong }} />;
};

/** Chevron used inside select wraps. */
export const SelectChevron = () => <Icon name="chevronDown" size="sm" color="text3" />;
