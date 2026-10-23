import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SignInScreen } from '@/features/onboarding/SignInScreen';
import { renderScreen, routerCalls } from './render';

const signIn = async (password: string) => {
  await renderScreen(<SignInScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'brendan@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
};

describe('Sign in', () => {
  beforeEach(() => {
    routerCalls().length = 0;
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
});
