import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@/components/Button';
import { KV } from '@/components/KV';
import { ThemeProvider } from '@/theme';

const wrap = async (ui: React.ReactElement) => render(<ThemeProvider force="dark">{ui}</ThemeProvider>);

describe('Button', () => {
  it('fires once and is announced as a button', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Continue" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('does nothing while disabled or loading', async () => {
    const onPress = jest.fn();
    await wrap(
      <>
        <Button label="Disabled" disabled onPress={onPress} />
        <Button label="Busy" loading onPress={onPress} />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Disabled' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('KV', () => {
  it('renders each key and value', async () => {
    await wrap(<KV items={[{ k: 'Network fee', v: '≈ 0.000012 XRP' }, { k: 'Recipient receives', v: '299.749988 XRP', total: true }]} />);
    expect(screen.getByText('Network fee')).toBeTruthy();
    expect(screen.getByText('299.749988 XRP')).toBeTruthy();
  });
});
