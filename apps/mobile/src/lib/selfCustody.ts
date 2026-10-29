import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { deriveAddress } from 'ripple-keypairs';
import { areValidSecretNumbers, secretNumbersToWallet } from './secretNumbers';

/**
 * On-device recovery-phrase import. The phrase exists only in component state while typed: it is never logged,
 * sent to a server or persisted. Only the derived key is stored, in the Keychain/Keystore, one entry per wallet,
 * and every use asks for the phone's fingerprint, face or passcode (decision 11). Callers must clear the word state
 * as soon as `importFromPhrase` returns.
 */
export const isKnownWord = (word: string): boolean => wordlist.includes(word.trim().toLowerCase());
export const isValidPhrase = (words: string[]): boolean =>
  (words.length === 12 || words.length === 24) && words.every(isKnownWord) && validateMnemonic(words.map((w) => w.trim().toLowerCase()).join(' '), wordlist);

const LEGACY_KEY = 'xrp.selfcustody.v1';
const keyFor = (address: string) => `xrp.selfcustody.v2.${address}`;

export type SelfCustodyAccount = { address: string };
type StoredKey = { address: string; publicKey: string; privateKey: string };

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

/** Same derivation as xrpl.js `Wallet.fromMnemonic` (bip39, m/44'/144'/0'/0/0), without pulling xrpl.js into the app bundle. */
export const deriveWallet = (mnemonic: string): { classicAddress: string; publicKey: string; privateKey: string } => {
  const node = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive("m/44'/144'/0'/0/0");
  if (!node.privateKey || !node.publicKey) throw new Error('Unable to derive a key from that phrase.');
  const publicKey = hex(node.publicKey);
  return { classicAddress: deriveAddress(publicKey), publicKey, privateKey: `00${hex(node.privateKey)}` };
};

/** Asks for the phone's fingerprint, face or passcode. A phone with no screen lock can't hold a wallet key. */
const confirmOwner = async (promptMessage: string): Promise<void> => {
  if (Platform.OS === 'web') return;
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    throw new Error('Set a screen lock (PIN, fingerprint or face) on this phone first. Your wallet key is protected by it.');
  }
  const auth = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false });
  if (!auth.success) throw new Error('Authentication was cancelled.');
};

/** With biometrics, the Keystore itself also demands them on every read; with only a passcode, `confirmOwner` guards it. */
const storeOptions = async (): Promise<SecureStore.SecureStoreOptions> => {
  const bio = Platform.OS !== 'web' && (await LocalAuthentication.getEnrolledLevelAsync()) >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
  return {
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    ...(bio ? { requireAuthentication: true, authenticationPrompt: 'Unlock your wallet' } : {}),
  };
};

/** Stores a wallet's key on this phone, behind the owner's fingerprint, face or passcode. */
const storeWallet = async (wallet: { classicAddress: string; publicKey: string; privateKey: string }): Promise<SelfCustodyAccount> => {
  if (Platform.OS !== 'web') {
    const value = JSON.stringify({ address: wallet.classicAddress, privateKey: wallet.privateKey, publicKey: wallet.publicKey } satisfies StoredKey);
    const options = await storeOptions();
    try {
      await SecureStore.setItemAsync(keyFor(wallet.classicAddress), value, options);
    } catch {
      // Some phones refuse biometric-bound keys; the passcode check still guards every use.
      await SecureStore.setItemAsync(keyFor(wallet.classicAddress), value, { keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY });
    }
    await writeIndex([...(await readIndex()), wallet.classicAddress]);
  }
  return { address: wallet.classicAddress };
};

export const importFromPhrase = async (words: string[]): Promise<SelfCustodyAccount> => {
  if (!isValidPhrase(words)) throw new Error('That phrase isn’t valid. Check each word and its order.');
  await confirmOwner('Confirm to import your wallet');
  return storeWallet(deriveWallet(words.map((w) => w.trim().toLowerCase()).join(' ')));
};

/** Xaman's Secret Numbers (8 rows of 6 digits). */
export const importFromSecretNumbers = async (rows: string[]): Promise<SelfCustodyAccount> => {
  if (!areValidSecretNumbers(rows)) throw new Error('Those numbers aren’t right. Check each row of 6 digits.');
  await confirmOwner('Confirm to import your wallet');
  return storeWallet(secretNumbersToWallet(rows));
};

/** Addresses whose keys are on this phone (public data only), so the app knows which wallets can send. */
const INDEX = 'xrp.selfcustody.index';
const readIndex = async (): Promise<string[]> => JSON.parse((await SecureStore.getItemAsync(INDEX).catch(() => null)) ?? '[]') as string[];
const writeIndex = (list: string[]) => SecureStore.setItemAsync(INDEX, JSON.stringify([...new Set(list)]));

/** Whether this phone holds the key for `address` (without unlocking it). */
export const hasKey = async (address: string): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  if ((await readIndex()).includes(address)) return true;
  const legacy = await SecureStore.getItemAsync(LEGACY_KEY).catch(() => null);
  return !!legacy && (JSON.parse(legacy) as StoredKey).address === address;
};

/** Unlocks the key for `address` after the owner confirms. Use it at once and drop it; never store or log it. */
export const unlockKey = async (address: string): Promise<{ publicKey: string; privateKey: string }> => {
  if (Platform.OS === 'web') throw new Error('Sending from your own wallet works in the phone app.');
  await confirmOwner('Confirm to send from your wallet');
  const raw =
    (await SecureStore.getItemAsync(keyFor(address), await storeOptions()).catch(() => SecureStore.getItemAsync(keyFor(address)))) ??
    (await SecureStore.getItemAsync(LEGACY_KEY).catch(() => null));
  const stored = raw ? (JSON.parse(raw) as StoredKey) : null;
  if (!stored || stored.address !== address) throw new Error('This wallet’s key isn’t on this phone. Import it with its recovery phrase first.');
  return { publicKey: stored.publicKey, privateKey: stored.privateKey };
};

export const removeSelfCustody = async (address?: string): Promise<void> => {
  if (Platform.OS === 'web') return;
  if (address) {
    await SecureStore.deleteItemAsync(keyFor(address));
    await writeIndex((await readIndex()).filter((a) => a !== address));
  }
  const legacy = await SecureStore.getItemAsync(LEGACY_KEY).catch(() => null);
  if (legacy && (!address || (JSON.parse(legacy) as StoredKey).address === address)) await SecureStore.deleteItemAsync(LEGACY_KEY);
};
