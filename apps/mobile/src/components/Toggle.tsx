import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';

/** `.toggle` — 44×26, border-strong off / accent on; knob 20 white off, on-accent on; 150 ms. role=switch. */
export const Toggle = ({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => {
  const { c } = useTheme();
  const x = useSharedValue(on ? 18 : 0);
  useEffect(() => {
    x.value = withTiming(on ? 18 : 0, { duration: 150 });
  }, [on, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!on)}
      hitSlop={9}
      style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: on ? c.accent : c.borderStrong, opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 3,
            left: 3,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: on ? c.onAccent : c.knobOff,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 1,
            shadowOffset: { width: 0, height: 1 },
          },
          knob,
        ]}
      />
    </Pressable>
  );
};
