import { useEffect } from 'react';
import { AppState } from 'react-native';
import { env, hasBackend } from './env';

const EVERY_MS = 5 * 60_000;

const nudge = () =>
  fetch(`${env.supabaseUrl}/functions/v1/upkeep`, {
    method: 'POST',
    headers: { apikey: env.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => undefined);

/**
 * Keeps scheduled upkeep running with no server: while the app is open it asks Supabase to run whatever is due
 * (prices, quote expiry, loan checks, the daily reconciliation). The server decides what's due, so extra calls are free.
 */
export const useUpkeep = () => {
  useEffect(() => {
    if (!hasBackend()) return undefined;
    void nudge();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void nudge();
    }, EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void nudge();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
};
