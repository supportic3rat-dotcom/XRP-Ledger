import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Face ID / fingerprint confirmation before sensitive actions (withdrawals). Falls back to the device passcode.
 * Devices without biometrics or a passcode continue (the server still requires the TOTP code / aal2).
 */
/** What this phone unlocks with, for labels: null when it has no Face ID or fingerprint set up (or on the web). */
export const biometricName = async (): Promise<string | null> => {
  if (Platform.OS === 'web') return null;
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  if (!hardware || !enrolled) return null;
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return Platform.OS === 'ios' ? 'Face ID' : 'face unlock';
  return Platform.OS === 'ios' ? 'Touch ID' : 'fingerprint';
};

export const confirmWithDevice = async (promptMessage: string): Promise<boolean> => {
  if (Platform.OS === 'web') return true;
  const [hardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  if (!hardware || !enrolled) return true;
  const r = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false, cancelLabel: 'Cancel' });
  return r.success;
};
