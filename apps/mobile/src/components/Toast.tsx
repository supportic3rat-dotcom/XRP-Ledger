import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { create } from 'zustand';
import { useTheme } from '@/theme';
import { T } from './T';

type ToastState = {
  message: string | null;
  /** `.toast` bottom: 100 above the tab bar, 32 on Security. */
  bottom: number;
  durationMs: number;
  show: (message: string, opts?: { bottom?: number; durationMs?: number }) => void;
  hide: () => void;
};

export const useToast = create<ToastState>()((set) => ({
  message: null,
  bottom: 100,
  durationMs: 2800,
  show: (message, opts) => set({ message, bottom: opts?.bottom ?? 100, durationMs: opts?.durationMs ?? 2800 }),
  hide: () => set({ message: null }),
}));

/** `.toast` — inverse colours, role=status, auto-hides after ~3 s. */
export const ToastHost = () => {
  const { c } = useTheme();
  const { message, bottom, durationMs, hide } = useToast();
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(hide, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom, zIndex: 40 }}>
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.text }}
      >
        <T size={13} rawColor={c.bg}>
          {message}
        </T>
      </Animated.View>
    </View>
  );
};
