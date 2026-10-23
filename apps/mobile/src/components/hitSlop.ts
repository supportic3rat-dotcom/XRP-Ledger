import type { Insets } from 'react-native';

/** Extra touch area so a control drawn shorter than 44 pt still has a 44 pt target (WCAG 2.5.5 / Apple HIG). */
export const slopFor = (height: number, width?: number): Insets | undefined => {
  const v = Math.max(0, Math.ceil((44 - height) / 2));
  const h = width === undefined ? 0 : Math.max(0, Math.ceil((44 - width) / 2));
  return v || h ? { top: v, bottom: v, left: h, right: h } : undefined;
};
