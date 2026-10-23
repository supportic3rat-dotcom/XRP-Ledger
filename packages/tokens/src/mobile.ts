/** Mobile colour tokens, copied verbatim from `.m{…}` (light) and `.m.dark{…}` (dark) in screens-html. */
export type MobileColors = {
  bg: string;
  surface: string;
  sunken: string;
  border: string;
  borderStrong: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  onAccent: string;
  pos: string;
  neg: string;
  warn: string;
  warnSoft: string;
  negSoft: string;
  dotWarn: string;
  /** `.toggle .knob{background:#fff}` — same in both themes. */
  knobOff: string;
  knobShadow: string;
  /** Browser-default form colours the design renders with (sampled from the reference PNGs). */
  placeholder: string;
  checkboxFill: string;
  checkboxBorder: string;
};

export const mobileLight: MobileColors = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  sunken: '#F4F4F4',
  border: '#E6E6E6',
  borderStrong: '#D4D4D4',
  text: '#0A0A0A',
  text2: '#474747',
  text3: '#6B6B6B',
  accent: '#0A0A0A',
  accentSoft: '#F0F0F0',
  accentText: '#0A0A0A',
  onAccent: '#FFFFFF',
  pos: '#15803D',
  neg: '#C81E1E',
  warn: '#A16207',
  warnSoft: '#FEF6E0',
  negSoft: '#FDECEC',
  dotWarn: '#EAB308',
  knobOff: '#FFFFFF',
  knobShadow: 'rgba(0,0,0,0.2)',
  placeholder: '#757575',
  checkboxFill: '#FFFFFF',
  checkboxBorder: '#767676',
};

export const mobileDark: MobileColors = {
  bg: '#000000',
  surface: '#0D0D0D',
  sunken: '#1A1A1A',
  border: '#242424',
  borderStrong: '#383838',
  text: '#FFFFFF',
  text2: '#BDBDBD',
  text3: '#8F8F8F',
  accent: '#FFFFFF',
  accentSoft: '#1F1F1F',
  accentText: '#FFFFFF',
  onAccent: '#000000',
  pos: '#4ADE80',
  neg: '#EF4444',
  warn: '#FACC15',
  warnSoft: '#262006',
  negSoft: '#2A0D0D',
  dotWarn: '#FACC15',
  knobOff: '#FFFFFF',
  knobShadow: 'rgba(0,0,0,0.2)',
  placeholder: '#757575',
  checkboxFill: '#FFFFFF',
  checkboxBorder: '#767676',
};

/** Scrim colours differ per screen in the design; kept exactly (decision 2). */
export const scrims = {
  /** AssetDetail, Security, Support */
  deep: 'rgba(0,0,0,0.55)',
  /** Welcome, Borrow, Earn, Profile */
  green: 'rgba(10,16,14,0.4)',
  /** Home */
  home: 'rgba(5,10,8,0.5)',
} as const;
export type ScrimTone = keyof typeof scrims;

/** `.sheet` box-shadow `0 -12px 32px -16px rgba(0,0,0,α)`. */
export const sheetShadowOpacity = { soft: 0.25, strong: 0.4 } as const;
export type SheetShadowTone = keyof typeof sheetShadowOpacity;
