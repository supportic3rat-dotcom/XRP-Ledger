import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK = 1800; // SecureStore values must stay under ~2 KB

/** Supabase auth storage backed by the Keychain / Keystore (never AsyncStorage). Values are chunked. */
export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.getItem(key) ?? null;
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.every((p) => p !== null) ? parts.join('') : null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.setItem(key, value);
    const parts = value.match(new RegExp(`.{1,${CHUNK}}`, 'gs')) ?? [''];
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key}.${i}`, p, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })));
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') return globalThis.sessionStorage?.removeItem(key);
    const count = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0);
    await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)));
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};
