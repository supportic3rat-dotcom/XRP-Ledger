import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useStaff } from '@/features/admin/session';
import { SignInScreen } from '@/features/onboarding/SignInScreen';
import { renderScreen, routerCalls } from './render';

const signIn = async (password: string, email = 'brendan@example.com') => {
  await renderScreen(<SignInScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
};

describe('Sign in', () => {
  beforeEach(() => {
    routerCalls().length = 0;
    useStaff.getState().setSession(null);
  });

  it('signs straight in with the right email and password (no code step)', async () => {
    await signIn('Prototype-Pass-2026');
    await waitFor(() => expect(routerCalls().some((c) => c.method === 'replace' && c.to === '/')).toBe(true));
    expect(screen.queryByText('Two-factor check')).toBeNull();
  });

  it('validates the password length before calling the API', async () => {
    await signIn('short');
    expect(await screen.findByText('Passwords are at least 8 characters.')).toBeTruthy();
  });

  it('shows the attempts left on a wrong password and stays on sign-in', async () => {
    await signIn('wrong-password');
    expect(await screen.findByText(/attempts left before a 15-minute lock/)).toBeTruthy();
    expect(routerCalls().some((c) => c.method === 'replace' && c.to === '/')).toBe(false);
  });

  it('opens the operations console for a staff email, not the wallet', async () => {
    await signIn('Any-Password-2026', 'support.xrp@gmail.com');
    await waitFor(() => expect(routerCalls().some((c) => c.method === 'replace' && c.to === '/ops')).toBe(true));
    expect(routerCalls().some((c) => c.method === 'replace' && c.to === '/')).toBe(false);
    expect(useStaff.getState().session?.me.role).toBe('operations');
  });

  it('gives the second staff account the Compliance role', async () => {
    await signIn('Any-Password-2026', 'support.xrp+compliance@gmail.com');
    await waitFor(() => expect(useStaff.getState().session?.me.role).toBe('compliance'));
  });

  it('keeps customers out of the console', async () => {
    await signIn('Prototype-Pass-2026');
    await waitFor(() => expect(routerCalls().some((c) => c.method === 'replace' && c.to === '/')).toBe(true));
    expect(useStaff.getState().session).toBeNull();
  });
});
