import AsyncStorage from '@react-native-async-storage/async-storage';

/** A session lasts 15 minutes from the last use, whether the app stayed open or was closed (TDD: idle limit). */
export const SESSION_LIMIT_MS = 15 * 60_000;

const KEY = 'xrp.last-active';
const SAVE_EVERY_MS = 30_000;

let last = Date.now();
let saved = 0;

export const saveLastActive = () => {
  saved = last;
  AsyncStorage.setItem(KEY, String(last)).catch(() => undefined);
};

/** Called on every touch. Saved at most every 30 seconds; going to the background always saves. */
export const markActive = () => {
  last = Date.now();
  if (last - saved > SAVE_EVERY_MS) saveLastActive();
};

export const loadLastActive = async () => {
  last = Number(await AsyncStorage.getItem(KEY).catch(() => null)) || 0;
};

export const isSessionExpired = () => Date.now() - last > SESSION_LIMIT_MS;
