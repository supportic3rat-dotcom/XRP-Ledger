import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Hide-amounts preference (spec: amounts shown as ••••). */
export const useHideAmounts = create<{ hidden: boolean; toggle: () => void }>()(
  persist((set) => ({ hidden: false, toggle: () => set((s) => ({ hidden: !s.hidden })) }), {
    name: 'xrp-hide-amounts',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

export const MASK = '••••';
