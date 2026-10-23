import Constants from 'expo-constants';
import { Platform } from 'react-native';

const platformName = (): string => {
  if (Platform.OS === 'ios') return Platform.isPad ? 'iPad' : 'iPhone';
  if (Platform.OS === 'android') return 'Android phone';
  return 'Web browser';
};

/** Identifies this device to Edge Functions so Security can list it and sign it out. No location is sent. */
export const deviceHeaders = (): Record<string, string> => ({
  'x-device-name': (Constants.deviceName ?? platformName()).slice(0, 60),
  'x-device-kind': Platform.OS === 'web' ? 'laptop' : 'phone',
});
