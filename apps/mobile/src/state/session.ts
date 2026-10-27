import { Platform } from 'react-native';
import { create } from 'zustand';
import { hasBackend, skipAuth } from '@/lib/env';

type SessionState = {
  signedIn: boolean;
  /** Email used during sign-in / sign-up, kept only in memory. */
  pendingEmail: string;
  setSignedIn: (v: boolean) => void;
  setPendingEmail: (email: string) => void;
};

/** Development aids (demo backend only): `?session=1` on the web preview, or EXPO_PUBLIC_SKIP_AUTH=1 on device, starts signed in. */
const startSignedIn = (): boolean => {
  if (hasBackend()) return false;
  if (skipAuth()) return true;
  return Platform.OS === 'web' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('session') === '1';
};

export const useSession = create<SessionState>()((set) => ({
  signedIn: startSignedIn(),
  pendingEmail: '',
  setSignedIn: (signedIn) => set({ signedIn }),
  setPendingEmail: (pendingEmail) => set({ pendingEmail }),
}));
