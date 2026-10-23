import { mobileDark, mobileLight, type MobileColors } from '@xrp/tokens';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferences } from '@/state/preferences';

export type Scheme = 'dark' | 'light';
type ThemeValue = { scheme: Scheme; c: MobileColors };

const ThemeContext = createContext<ThemeValue>({ scheme: 'dark', c: mobileDark });

/** Dark is the default; Light and System come from Profile → Appearance. */
export const ThemeProvider = ({ children, force }: { children: ReactNode; force?: Scheme }) => {
  const preference = usePreferences((s) => s.theme);
  const system = useColorScheme();
  const scheme: Scheme = force ?? (preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference);
  const value = useMemo(() => ({ scheme, c: scheme === 'dark' ? mobileDark : mobileLight }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeValue => useContext(ThemeContext);
