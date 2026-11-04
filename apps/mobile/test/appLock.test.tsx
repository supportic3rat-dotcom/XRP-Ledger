import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { AppLock } from '@/components/AppLock';
import { usePreferences } from '@/state/preferences';
import { useSession } from '@/state/session';
import { renderScreen } from './render';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => [2]),
  authenticateAsync: jest.fn(async () => ({ success: false })),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
}));

describe('App lock', () => {
  const os = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'ios';
  });
  afterAll(() => {
    Platform.OS = os;
  });

  it('stays off unless turned on', async () => {
    usePreferences.setState({ appLock: false });
    useSession.setState({ signedIn: true });
    await renderScreen(<AppLock />);
    expect(screen.queryByText('XRP Ledger is locked')).toBeNull();
  });

  it('covers the app at launch until Face ID succeeds', async () => {
    usePreferences.setState({ appLock: true });
    useSession.setState({ signedIn: true });
    await renderScreen(<AppLock />);
    expect(await screen.findByText('XRP Ledger is locked')).toBeTruthy();
    expect(await screen.findByText('Unlock with Face ID to continue.')).toBeTruthy();

    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValueOnce({ success: true } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.queryByText('XRP Ledger is locked')).toBeNull());
    usePreferences.setState({ appLock: false });
  });
});
