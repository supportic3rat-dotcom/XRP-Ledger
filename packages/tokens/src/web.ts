/**
 * Desktop customer dashboard tokens from `.app{…}` in Main.dc.html, plus hard-coded colours.
 * The accent-derived colours are `color-mix(in oklab, …)` resolved for each selectable accent.
 */
export const webColors = {
  canvas: '#F7F8F6',
  surface: '#FFFFFF',
  border: '#E2E6E2',
  borderStrong: '#D2D9D4',
  text: '#17211D',
  text2: '#4C5A54',
  text3: '#5F6D66',
  pos: '#13704C',
  neg: '#B13A2B',
  warn: '#875D00',
  warnDot: '#D49711',
  hover: '#F3F5F2',
  rowDivider: '#EEF1ED',
  rowHover: '#FAFBF9',
  sidebar: '#FBFCFA',
  segBg: '#EEF1ED',
  txIcon: '#F0F3EF',
  bannerInfo: '#F1F4F1',
  bannerWarn: '#FBF4E4',
  bannerWarnText: '#6E4C00',
  bannerError: '#FBEDEA',
  bannerErrorText: '#8E2D21',
  avatarBg: '#DCE7E2',
  avatarFg: '#17453B',
  stepTrack: '#E6EAE6',
  toggleOff: '#CBD3CE',
  skelA: '#EDF0EC',
  skelB: '#F5F7F4',
  toastBg: '#17211D',
  readonlyBg: '#F7F8F6',
  chartGrid: '#EDF0EC',
  chartHoverLine: '#C9D1CB',
  link: '#176B5B',
  linkHover: '#125A4C',
  white: '#FFFFFF',
} as const;

export const webAccents = {
  '#0A0A0A': { soft: '#E5E5E5', line: '#C1C1C1', hover: '#060606', text: '#060606' },
  '#176B5B': { soft: '#EBF1EF', line: '#CDDDD8', hover: '#105548', text: '#0F5044' },
  '#1F5A7A': { soft: '#EAEFF3', line: '#CCD9E1', hover: '#174761', text: '#15435C' },
  '#7A4E12': { soft: '#F3EEE9', line: '#E1D6CA', hover: '#613D0C', text: '#5C3A0B' },
} as const;
export type WebAccent = keyof typeof webAccents;
export const defaultWebAccent: WebAccent = '#0A0A0A';

/** Asset glyph backgrounds on the desktop dashboard. */
export const webAssetColors = {
  XRP: '#17211D',
  BTC: '#B8640A',
  ETH: '#4B5563',
  SOL: '#3F4F5F',
  LTC: '#5A6670',
} as const;
