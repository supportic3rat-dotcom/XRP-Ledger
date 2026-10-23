import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './T';
import { slopFor } from './hitSlop';

/** `.copy` — outline button. As a design `<button>` its label inherits 400; the `<a class="copy">` variant is 500. Deposit: 36 tall / 10 radius / 13px; Home: 28 / 8 / 12px (44 / 13.5px in the detail sheet). */
export const CopyButton = ({
  label,
  onPress,
  height = 36,
  radius = 10,
  font = 13,
  weight = 400,
  icon,
  style,
  accessibilityLabel,
  role = 'button',
}: {
  label: string;
  weight?: 400 | 500;
  onPress: () => void;
  height?: number;
  radius?: number;
  font?: number;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  role?: 'button' | 'link';
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={slopFor(height)}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height,
          paddingHorizontal: height === 28 ? 10 : 12,
          borderWidth: 1,
          borderColor: c.borderStrong,
          borderRadius: radius,
          backgroundColor: pressed ? c.sunken : c.surface,
        },
        style,
      ]}
    >
      {icon}
      <T size={font} weight={weight}>
        {label}
      </T>
    </Pressable>
  );
};
