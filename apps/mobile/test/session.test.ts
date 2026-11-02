import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSessionExpired, loadLastActive, markActive, SESSION_LIMIT_MS } from '@/lib/lastActive';

describe('staying signed in after the app closes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps a session used within 15 minutes', async () => {
    await AsyncStorage.setItem('xrp.last-active', String(Date.now() - SESSION_LIMIT_MS + 60_000));
    await loadLastActive();
    expect(isSessionExpired()).toBe(false);
  });

  it('ends a session unused for longer', async () => {
    await AsyncStorage.setItem('xrp.last-active', String(Date.now() - SESSION_LIMIT_MS - 60_000));
    await loadLastActive();
    expect(isSessionExpired()).toBe(true);
  });

  it('ends a session with no record of use', async () => {
    await AsyncStorage.removeItem('xrp.last-active');
    await loadLastActive();
    expect(isSessionExpired()).toBe(true);
  });

  it('counts a touch as use', async () => {
    await AsyncStorage.setItem('xrp.last-active', '1');
    await loadLastActive();
    markActive();
    expect(isSessionExpired()).toBe(false);
  });
});
