import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from '@xrp/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type PreferencesState = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  /** Ask for Face ID / fingerprint (or the phone's passcode) to open the app on this phone. */
  appLock: boolean;
  setAppLock: (on: boolean) => void;
};

/** UI-only preferences. Persisted in AsyncStorage (never secrets). */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      appLock: false,
      setAppLock: (appLock) => set({ appLock }),
    }),
    { name: 'xrp-preferences', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
