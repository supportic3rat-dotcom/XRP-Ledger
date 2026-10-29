import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from '@/data';
import { queryClient } from '@/data/queryClient';
import { qk } from '@/data/keys';

/**
 * Wallets connected before the customer has an account (from Welcome → Connect a wallet). Only public addresses are
 * kept, on this phone, until sign-up or sign-in, then linked to the account. Self-custody keys stay in their own
 * secure entries either way.
 */
type Pending = { address: string; access: 'watch' | 'self_custody' };
const KEY = 'xrp.pending.wallets';

const read = async (): Promise<Pending[]> => {
  if (Platform.OS === 'web') return [];
  return JSON.parse((await SecureStore.getItemAsync(KEY).catch(() => null)) ?? '[]') as Pending[];
};
const write = async (list: Pending[]) => {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(KEY, JSON.stringify(list));
};

export const savePendingWallet = async (w: Pending) => write([...(await read()).filter((x) => x.address !== w.address), w]);
export const dropPendingWallet = async (address: string) => write((await read()).filter((x) => x.address !== address));

/** Links wallets connected before sign-in, once signed in. Each that fails stays pending for the next sign-in. */
export const useAttachPendingWallets = (signedIn: boolean) => {
  useEffect(() => {
    if (!signedIn) return;
    void (async () => {
      const list = await read();
      if (!list.length) return;
      const left: Pending[] = [];
      for (const w of list) {
        try {
          await (w.access === 'self_custody' ? api.addSelfCustodyWallet(w.address) : api.addWatchWallet(w.address));
        } catch {
          left.push(w);
        }
      }
      await write(left);
      await queryClient.invalidateQueries({ queryKey: qk.externalWallets });
    })();
  }, [signedIn]);
};
