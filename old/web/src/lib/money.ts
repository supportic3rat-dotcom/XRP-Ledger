import { divRound } from '@xrp/ledger';

/** "6,420.10" from integer units at a scale (6 for XRP drops), rounded half-up to `decimals`. */
export const formatUnits = (units: bigint, scale: number, decimals: number): string => {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const shift = scale - decimals;
  const scaled = shift >= 0 ? divRound(abs, 10n ** BigInt(shift)) : abs * 10n ** BigInt(-shift);
  const s = scaled.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = decimals ? `.${s.slice(-decimals)}` : '';
  return `${neg ? '−' : ''}${whole}${frac}`;
};

/** Parse a typed decimal ("1,250.5") into integer units; null if it isn't a plain positive number. */
export const parseUnits = (text: string, scale: number): bigint | null => {
  const t = text.replace(/,/g, '').trim();
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return null;
  const [w = '0', f = ''] = t.split('.');
  if (f.length > scale) return null;
  return BigInt(w || '0') * 10n ** BigInt(scale) + BigInt((f + '0'.repeat(scale)).slice(0, scale) || '0');
};

/** USD cents of an amount at a price, half-up. */
export const centsOf = (units: bigint, scale: number, priceMicro: bigint): bigint => divRound(units * priceMicro, 10n ** BigInt(scale + 4));

/** "$15,279.84" from cents (exact: integer cents → string). */
export const usdCents = (cents: bigint): string => {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}$${whole}.${(abs % 100n).toString().padStart(2, '0')}`;
};
export const usdOf = (units: bigint, scale: number, priceMicro: bigint) => usdCents(centsOf(units, scale, priceMicro));
/** "$2.3800" under $10, "$98,000.00" above (design). */
export const priceText = (micro: bigint): string => (micro < 10_000_000n ? `$${formatUnits(micro, 6, 4)}` : usdCents(divRound(micro, 10_000n)));

/** Full precision with trailing zeros trimmed, but at least `minDecimals` ("299.749988", "300.00"). */
export const formatUnitsPrecise = (units: bigint, scale: number, minDecimals: number): string => {
  const full = formatUnits(units, scale, scale);
  const [whole, frac = ''] = full.split('.');
  const trimmed = frac.replace(/0+$/, '').padEnd(minDecimals, '0');
  return trimmed ? `${whole}.${trimmed}` : (whole ?? '0');
};
