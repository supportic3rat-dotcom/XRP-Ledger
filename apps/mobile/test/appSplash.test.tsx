import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AppSplash } from '@/components/AppSplash';

jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(async () => true) }));
// Layout animations take Reanimated's web path under Jest, which needs a DOM.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View: ({ exiting: _exiting, ...props }: Record<string, unknown>) => <View {...props} /> }, FadeOut: { duration: () => undefined } };
});

describe('AppSplash', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('stays up until its image loads, then hides the native splash and clears itself', async () => {
    await render(<AppSplash />);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

    await fireEvent(screen.getByLabelText('XRP Ledger'), 'loadEnd');
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('XRP Ledger')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    expect(screen.queryByLabelText('XRP Ledger')).toBeNull();
  });
});
