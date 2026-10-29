import { scrims, sheetShadowOpacity, type ScrimTone, type SheetShadowTone } from '@xrp/tokens';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Scrim colour used by the screen in the design. */
  scrim?: ScrimTone;
  shadow?: SheetShadowTone;
  /** `max-height` of `.sheet` as a fraction of the frame: 0.82 / 0.86 / 0.88 / 0.9; null = content height. */
  maxHeight?: number | null;
  /** Horizontal padding: 16, or 20 on Welcome and Profile. */
  paddingX?: number;
  /** Kept for callers that stack a sheet over another (Home: history → detail); each sheet is its own modal. */
  stackBehavior?: 'push' | 'replace' | 'switch';
  accessibilityLabel?: string;
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
};

/**
 * `.sheet` + `.scrim`: 16 top radius, top border, slide-up 220 ms (fade only with reduced motion).
 * Built on React Native's Modal, so it behaves the same on every phone (the back button and the scrim close it).
 */
export const Sheet = ({ open, onClose, children, scrim = 'deep', shadow = 'soft', maxHeight = 0.86, paddingX = 16, accessibilityLabel }: SheetProps) => {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: reduced ? 1 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: reduced ? 1 : 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, reduced, progress]);

  const translateY = reduced ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.6, 0] });

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrims[scrim], opacity: progress }]}>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.bottom} pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            style={{
              maxHeight: Math.round(height * (maxHeight ?? 0.95)),
              backgroundColor: c.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderTopWidth: 1,
              borderColor: c.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -12 },
              shadowOpacity: sheetShadowOpacity[shadow],
              shadowRadius: 16,
              elevation: 16,
              opacity: reduced ? progress : 1,
              transform: [{ translateY }],
            }}
          >
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 20, paddingHorizontal: paddingX, paddingBottom: 32 + insets.bottom }}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
});

/** `.grab` — 36×4 handle; top margin −8, bottom 14 (16 on Welcome/Earn/Borrow/Profile). */
export const Grab = ({ bottom = 14 }: { bottom?: number }) => {
  const { c } = useTheme();
  return <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginTop: -8, marginBottom: bottom, alignSelf: 'center' }} />;
};
