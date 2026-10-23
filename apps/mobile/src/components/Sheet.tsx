import { BottomSheetModal, BottomSheetScrollView, type BottomSheetBackdropProps, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { scrims, sheetShadowOpacity, type ScrimTone, type SheetShadowTone } from '@xrp/tokens';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
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
  /** Render a stacked sheet above another (Home: history → detail). */
  stackBehavior?: 'push' | 'replace' | 'switch';
  accessibilityLabel?: string;
};

const Backdrop = ({ animatedIndex, style, color, onPress }: BottomSheetBackdropProps & { color: string; onPress: () => void }) => {
  const animated = useAnimatedStyle(() => ({ opacity: interpolate(animatedIndex.value, [-1, 0], [0, 1], Extrapolation.CLAMP) }));
  return (
    <Animated.View style={[style, { backgroundColor: color }, animated]}>
      <Pressable accessibilityLabel="Close" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onPress} />
    </Animated.View>
  );
};

/** `.sheet` + `.scrim`: 16 top radius, top border, slide-up 220 ms (fade only with reduced motion). */
export const Sheet = ({
  open,
  onClose,
  children,
  scrim = 'deep',
  shadow = 'soft',
  maxHeight = 0.86,
  paddingX = 16,
  stackBehavior = 'switch',
  accessibilityLabel,
}: SheetProps) => {
  const ref = useRef<BottomSheetModal>(null);
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  const Background = ({ style }: BottomSheetBackgroundProps) => (
    <View
      style={[
        style,
        {
          backgroundColor: c.surface,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderTopWidth: 1,
          borderLeftWidth: 0,
          borderRightWidth: 0,
          borderColor: c.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -12 },
          shadowOpacity: sheetShadowOpacity[shadow],
          shadowRadius: 16,
        },
      ]}
    />
  );

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight === null ? height : Math.round(height * maxHeight)}
      onDismiss={onClose}
      stackBehavior={stackBehavior}
      handleComponent={null}
      backgroundComponent={Background}
      backdropComponent={(props) => <Backdrop {...props} color={scrims[scrim]} onPress={onClose} />}
      animationConfigs={reduced ? { duration: 1 } : { duration: 220 }}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityViewIsModal
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: paddingX, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

/** `.grab` — 36×4 handle; top margin −8, bottom 14 (16 on Welcome/Earn/Borrow/Profile). */
export const Grab = ({ bottom = 14 }: { bottom?: number }) => {
  const { c } = useTheme();
  return <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginTop: -8, marginBottom: bottom, alignSelf: 'center' }} />;
};
