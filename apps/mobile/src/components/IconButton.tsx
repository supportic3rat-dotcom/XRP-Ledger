import type { IconName } from '@xrp/tokens';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  /** Unread dot: 7×7 neg with a 2px ring in the page background, at top 11 / right 12. */
  dot?: boolean;
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
};

/** `.icon-btn` — 44×44 target, 12 radius, transparent. */
export const IconButton = ({ icon, label, onPress, dot, size = 'md', style }: IconButtonProps) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={0}
      style={({ pressed }) => [
        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.sunken : 'transparent' },
        style,
      ]}
    >
      <Icon name={icon} size={size} />
      {dot ? (
        <View
          style={{
            position: 'absolute',
            top: 9,
            right: 10,
            width: 11,
            height: 11,
            borderRadius: 5.5,
            backgroundColor: c.neg,
            borderWidth: 2,
            borderColor: c.bg,
          }}
        />
      ) : null}
    </Pressable>
  );
};
