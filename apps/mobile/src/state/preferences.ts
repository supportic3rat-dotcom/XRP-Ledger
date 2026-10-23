import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from '@xrp/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type PreferencesState = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

/** UI-only preferences. Persisted in AsyncStorage (never secrets). */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'xrp-preferences', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
