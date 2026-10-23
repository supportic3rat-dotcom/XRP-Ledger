import { chartPaths } from '@xrp/providers';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';

/** Area + line chart in a 1000×100 viewBox (non-scaling 2px stroke), with the end-point dot. */
export const AreaChart = ({ values, height, ariaLabel }: { values: number[]; height: number; ariaLabel: string }) => {
  const { c } = useTheme();
  const { line, area, endTop } = useMemo(() => chartPaths(values), [values]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={ariaLabel} style={{ height, position: 'relative' }}>
      <Svg width="100%" height="100%" viewBox="0 0 1000 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
        <Path d={area} fill={c.accent} fillOpacity={0.08} stroke="none" />
        <Path d={line} fill="none" stroke={c.accent} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: '100%',
          top: `${endTop}%`,
          width: 16,
          height: 16,
          marginLeft: -8,
          marginTop: -8,
          borderRadius: 8,
          borderWidth: 3,
          borderColor: c.surface,
          backgroundColor: c.accent,
        }}
      />
    </View>
  );
};

/** Markets sparkline: 64×28, 1.5px stroke in the change colour. */
export const Sparkline = ({ path, color }: { path: string; color: string }) => (
  <Svg width={64} height={28} viewBox="0 0 100 30" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
    <Path d={path} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
  </Svg>
);
