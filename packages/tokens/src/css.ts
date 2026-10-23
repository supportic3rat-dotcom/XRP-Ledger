import { adminColors } from './admin.ts';
import { mobileDark, mobileLight } from './mobile.ts';
import { webColors } from './web.ts';

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/(\d)/g, '-$1');

const toVars = (colors: Record<string, string>): string =>
  Object.entries(colors)
    .map(([name, value]) => `--${kebab(name)}:${value};`)
    .join('');

/** CSS custom-property blocks for the web apps, generated from the same token objects. */
export const adminCssVars = (): string => toVars(adminColors);
export const webCssVars = (): string => toVars(webColors);
export const mobileCssVars = (theme: 'light' | 'dark'): string => toVars(theme === 'dark' ? mobileDark : mobileLight);
