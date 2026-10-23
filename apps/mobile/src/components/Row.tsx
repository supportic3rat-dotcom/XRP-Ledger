import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';

type RowProps = {
  children: ReactNode;
  first?: boolean;
  onPress?: () => void;
  /** Min height used by the screen: 52, 56, 60 or 64. */
  minHeight?: number;
  chevron?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  accessibilityState?: { expanded?: boolean; selected?: boolean; checked?: boolean };
  padding?: { v: number; h: number };
  gap?: number;
  align?: 'center' | 'flex-start';
  style?: StyleProp<ViewStyle>;
};

/** `.row` (and `.opt`, `.req`, `.note`, `.doc`, `.acc`): bordered list row inside a card. */
export const Row = ({
  children,
  first,
  onPress,
  minHeight = 56,
  chevron,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  padding = { v: 10, h: 14 },
  gap = 12,
  align = 'center',
  style,
}: RowProps) => {
  const { c } = useTheme();
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: align,
    gap,
    minHeight,
    paddingVertical: padding.v,
    paddingHorizontal: padding.h,
    borderTopWidth: first ? 0 : 1,
    borderTopColor: c.border,
  };
  const content = (
    <>
      {children}
      {chevron ? <Icon name="chevronRight" size="sm" color="text3" /> : null}
    </>
  );
  if (!onPress) return <View style={[base, style]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPress={onPress}
      style={({ pressed }) => [base, pressed ? { backgroundColor: c.sunken } : null, style]}
    >
      {content}
    </Pressable>
  );
};
