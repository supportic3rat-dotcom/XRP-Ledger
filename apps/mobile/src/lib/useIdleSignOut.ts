import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isSessionExpired, markActive, saveLastActive } from './lastActive';

/** Signs out after the session limit, checked every 30 seconds and when the app comes back to the front. */
export const useIdleSignOut = (active: boolean, signOut: () => Promise<void>) => {
  const latest = useRef(signOut);
  latest.current = signOut;

  useEffect(() => {
    if (!active) return undefined;
    const check = () => {
      if (isSessionExpired()) return void latest.current();
      return undefined;
    };
    const timer = setInterval(check, 30_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return saveLastActive();
      check();
      if (!isSessionExpired()) markActive();
      return undefined;
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [active]);
};
