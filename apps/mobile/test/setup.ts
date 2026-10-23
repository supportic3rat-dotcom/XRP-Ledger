// Native modules the components touch, replaced with in-memory versions for Jest.
// Reanimated's reduced-motion check reads matchMedia, which the React Native test environment lacks.
const noop = () => undefined;
// The RN test environment defines `window`, so Reanimated tries to add its web layout-animation <style>; an existing
// element makes it skip that.
(globalThis as unknown as { document?: unknown }).document ??= { getElementById: () => ({}) };
(window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop });
require('react-native-reanimated').setUpTests();
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void store.set(k, v),
    deleteItemAsync: async (k: string) => void store.delete(k),
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  };
});
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
require('react-native-gesture-handler/jestSetup');

/** expo-router: navigation calls are recorded on `routerCalls` for assertions. */
const mockRouterCalls: { method: string; to: unknown }[] = [];
const mockParams: { current: Record<string, string> } = { current: {} };
(globalThis as { routerCalls?: typeof mockRouterCalls }).routerCalls = mockRouterCalls;
(globalThis as { setRouteParams?: (p: Record<string, string>) => void }).setRouteParams = (p) => {
  mockParams.current = p;
};
jest.mock('expo-router', () => {
  const router = {
    push: (to: unknown) => mockRouterCalls.push({ method: 'push', to }),
    replace: (to: unknown) => mockRouterCalls.push({ method: 'replace', to }),
    back: () => mockRouterCalls.push({ method: 'back', to: null }),
    canGoBack: () => true,
    navigate: (to: unknown) => mockRouterCalls.push({ method: 'navigate', to }),
    dismissAll: () => undefined,
  };
  return {
    useRouter: () => router,
    router,
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: () => undefined,
    Link: ({ children }: { children: unknown }) => children,
    Redirect: () => null,
  };
});
