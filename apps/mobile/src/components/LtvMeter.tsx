import { View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './T';

/** `.meter` — zones healthy <65 (accent-soft), margin call 65–80 (warn-soft), liquidation ≥80 (neg-soft); marks at 65/80; labels in words. */
export const LtvMeter = ({ ltvPct, color, ariaLabel }: { ltvPct: number; color: string; ariaLabel: string }) => {
  const { c } = useTheme();
  const fill = Math.max(0, Math.min(100, ltvPct));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={ariaLabel}>
      <View style={{ height: 10, borderRadius: 5, overflow: 'visible' }}>
        <View style={{ position: 'absolute', inset: 0, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ width: '65%', backgroundColor: c.accentSoft }} />
          <View style={{ width: '15%', backgroundColor: c.warnSoft }} />
          <View style={{ flex: 1, backgroundColor: c.negSoft }} />
        </View>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill}%`, borderRadius: 5, backgroundColor: color }} />
        <View style={{ position: 'absolute', top: -4, bottom: -4, left: '65%', width: 2, backgroundColor: c.text3 }} />
        <View style={{ position: 'absolute', top: -4, bottom: -4, left: '80%', width: 2, backgroundColor: c.text3 }} />
      </View>
      <View style={{ position: 'relative', height: 30 }}>
        {[
          ['65%', 'Margin call', '65%'],
          ['80%', 'Liquidation', '80%'],
        ].map(([left, a, b]) => (
          <View key={a} style={{ position: 'absolute', top: 6, left: left as `${number}%`, width: 80, marginLeft: -40, alignItems: 'center' }}>
            <T size={11} lh={1.2} color="text3" align="center">
              {a}
              {'\n'}
              {b}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
};
