import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Face ID / fingerprint confirmation before sensitive actions (withdrawals). Falls back to the device passcode.
 * Devices without biometrics or a passcode continue (the server still requires the TOTP code / aal2).
 */
export const confirmWithDevice = async (promptMessage: string): Promise<boolean> => {
  if (Platform.OS === 'web') return true;
  const [hardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  if (!hardware || !enrolled) return true;
  const r = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false, cancelLabel: 'Cancel' });
  return r.success;
};
