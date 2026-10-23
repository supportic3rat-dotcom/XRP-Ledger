import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Blocks screenshots and blurs the app-switcher preview while mounted (Deposit, Security, recovery phrase). */
export const useNoScreenCapture = (key: string, enabled = true) => {
  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) return undefined;
    ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => {
      ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
    };
  }, [key, enabled]);
};
