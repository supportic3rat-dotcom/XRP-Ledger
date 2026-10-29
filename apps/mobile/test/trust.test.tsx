import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TrustScreen } from '@/features/onboarding/TrustScreen';
import { useSession } from '@/state/session';
import { renderScreen } from './render';

const type = async (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);
const pick = async (selectLabel: string, option: string) => {
  await fireEvent.press(screen.getAllByRole('button', { name: new RegExp(`^${selectLabel}:`) })[0]!);
  await fireEvent.press(await screen.findByText(option));
};

describe('Create your crypto trust', () => {
  beforeEach(() => useSession.getState().setSignedIn(false));

  it('walks through the four steps, insists on shares totalling 100%, and creates the account and trust', async () => {
    await renderScreen(<TrustScreen />);
    expect(screen.getByText('Create your crypto trust first')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Create my trust' }));

    // Step 1: type
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Choose a trust type.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /Spendthrift trust/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    // Step 2: personal information
    await type('First name', 'Ama');
    await type('Last name', 'Mensah');
    await type('Email', 'ama@example.com');
    await type('Password', 'Strong-Pass-2026');
    await type('Phone', '+233 24 123 4567');
    await type('Date of birth', '12041990');
    await type('Street address', '12 Ring Road');
    await type('City', 'Accra');
    await type('State / region', 'Greater Accra');
    await type('Postal code', 'GA-123');
    await pick('Country', 'Ghana');
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    // Step 3: beneficiaries must total 100%
    expect(await screen.findByText('Your beneficiaries')).toBeTruthy();
    await type('Full name', 'Kofi Mensah');
    await pick('Relationship', 'Child');
    await type('Share (%)', '60');
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/add up to 60%/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: /Add myself as a beneficiary/ }));
    await type('My share (%)', '40');
    expect(screen.getByText('100%')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    // Step 4: review, agree, create
    expect(await screen.findByText('Review and create')).toBeTruthy();
    expect(screen.getByText('Spendthrift trust')).toBeTruthy();
    expect(screen.getByText('Trust creation fee: FREE')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Create trust' }));
    expect(await screen.findByText('Agree to the Terms and Conditions to create your trust.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: /Terms and Conditions/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create trust' }));
    await waitFor(() => expect(screen.getByText('Your trust is created')).toBeTruthy(), { timeout: 5000 });
    expect(useSession.getState().signedIn).toBe(true);
  });
});
