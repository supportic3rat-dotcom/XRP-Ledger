import { fontFamily } from '@xrp/tokens';

export type Weight = 400 | 500 | 600;

import { Platform } from 'react-native';

/** The design's fallback stacks; glyphs Geist lacks (≈, ₿, Ξ, Ł) fall back exactly as in the browser. iOS falls back natively. */
const SANS_FALLBACK = ', ui-sans-serif, system-ui, -apple-system, sans-serif';
const MONO_FALLBACK = ', ui-monospace, monospace';

export const familyFor = (weight: Weight, mono = false): string => {
  const base = mono
    ? weight >= 500
      ? fontFamily.monoMedium
      : fontFamily.mono
    : weight === 600
      ? fontFamily.semibold
      : weight === 500
        ? fontFamily.medium
        : fontFamily.regular;
  return Platform.OS === 'web' ? base + (mono ? MONO_FALLBACK : SANS_FALLBACK) : base;
};
