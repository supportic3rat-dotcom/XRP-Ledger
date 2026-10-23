import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

/** `.steps` / `.progress` — 3px segments, gap 6; on = accent, off = border. */
export const StepBar = ({ total, current, allOn, style }: { total: number; current: number; allOn?: boolean; style?: StyleProp<ViewStyle> }) => {
  const { c } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: current }} style={[{ flexDirection: 'row', gap: 6 }, style]}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: allOn || i < current ? c.accent : c.border }} />
      ))}
    </View>
  );
};
