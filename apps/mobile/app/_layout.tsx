import 'react-native-get-random-values';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, useFonts } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/data/queryClient';
import { useUpkeep } from '@/lib/useUpkeep';
import { ThemeProvider, useTheme } from '@/theme';
import { ToastHost } from '@/components/Toast';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const Navigator = () => {
  const { c } = useTheme();
  useUpkeep();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined);
  }, [c.bg]);
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }} />
      <ToastHost />
    </>
  );
};

export default function RootLayout() {
  const [loaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, GeistMono_400Regular, GeistMono_500Medium });
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Navigator />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
