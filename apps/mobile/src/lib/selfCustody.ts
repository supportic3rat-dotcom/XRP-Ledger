import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { deriveAddress } from 'ripple-keypairs';

/**
 * On-device recovery-phrase import. The phrase exists only in component state while typed: it is never logged,
 * sent to a server or persisted. Only the derived key is stored, in the Keychain/Keystore behind device
 * authentication (decision 11). Callers must clear the word state as soon as `importFromPhrase` returns.
 */
export const isKnownWord = (word: string): boolean => wordlist.includes(word.trim().toLowerCase());
export const isValidPhrase = (words: string[]): boolean =>
  (words.length === 12 || words.length === 24) && words.every(isKnownWord) && validateMnemonic(words.map((w) => w.trim().toLowerCase()).join(' '), wordlist);

const KEY = 'xrp.selfcustody.v1';

export type SelfCustodyAccount = { address: string };

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

/** Same derivation as xrpl.js `Wallet.fromMnemonic` (bip39, m/44'/144'/0'/0/0), without pulling xrpl.js into the app bundle. */
export const deriveWallet = (mnemonic: string): { classicAddress: string; publicKey: string; privateKey: string } => {
  const node = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive("m/44'/144'/0'/0/0");
  if (!node.privateKey || !node.publicKey) throw new Error('Unable to derive a key from that phrase.');
  const publicKey = hex(node.publicKey);
  return { classicAddress: deriveAddress(publicKey), publicKey, privateKey: `00${hex(node.privateKey)}` };
};

export const importFromPhrase = async (words: string[]): Promise<SelfCustodyAccount> => {
  if (!isValidPhrase(words)) throw new Error('That phrase isn’t valid. Check each word and its order.');
  const auth = Platform.OS === 'web' ? { success: true } : await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to import your wallet' });
  if (!auth.success) throw new Error('Authentication was cancelled.');
  const wallet = deriveWallet(words.map((w) => w.trim().toLowerCase()).join(' '));
  if (Platform.OS !== 'web') {
    await SecureStore.setItemAsync(KEY, JSON.stringify({ address: wallet.classicAddress, privateKey: wallet.privateKey, publicKey: wallet.publicKey }), {
      requireAuthentication: true,
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      authenticationPrompt: 'Unlock your self-custody wallet',
    });
  }
  return { address: wallet.classicAddress };
};

export const removeSelfCustody = async (): Promise<void> => {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY);
};
