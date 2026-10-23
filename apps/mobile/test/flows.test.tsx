import { fireEvent, screen } from '@testing-library/react-native';
import { SignInScreen } from '@/features/onboarding/SignInScreen';
import { renderScreen, routerCalls } from './render';

const signIn = async (password: string) => {
  await renderScreen(<SignInScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'brendan@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
};

describe('Sign in', () => {
  it('asks for the second factor and rejects a malformed code', async () => {
    await signIn('Prototype-Pass-2026');
    expect(await screen.findByText('Two-factor check')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(await screen.findByText('Enter the 6-digit authenticator code.')).toBeTruthy();
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
