import type { Cents, Drops, MicroUsd, Units } from '@xrp/types';
import { asset, displayDecimals } from './assets.ts';

export const DROPS_PER_XRP = 1_000_000n;
export const CENTS_PER_USD = 100n;
export const MICRO_PER_USD = 1_000_000n;

const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Integer division rounding half away from zero (half-up for positives). */
export const divRound = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator === 0n) throw new RangeError('Division by zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n * 2n + d) / (2n * d);
  return negative ? -q : q;
};

const parseDecimal = (input: string, scale: number): bigint | null => {
  const cleaned = input.replace(/,/g, '').trim();
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '.') return null;
  const [whole = '0', fraction = ''] = cleaned.split('.');
  if (fraction.length > scale) return null;
  return BigInt(whole || '0') * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0') || '0');
};

/** Parses user input like "1,250.5" into drops. Returns null for invalid or over-precise input. */
export const parseXrp = (input: string): Drops | null => parseDecimal(input, 6);
/** Parses user input like "604.93" into cents. */
export const parseUsd = (input: string): Cents | null => parseDecimal(input, 2);

export const xrpToDrops = (xrp: number | string): Drops => {
  const parsed = parseXrp(String(xrp));
  if (parsed === null) throw new RangeError(`Invalid XRP amount: ${xrp}`);
  return parsed;
};
export const usdToCents = (usd: number | string): Cents => {
  const parsed = parseUsd(String(usd));
  if (parsed === null) throw new RangeError(`Invalid USD amount: ${usd}`);
  return parsed;
};
export const usdToMicro = (usd: string): MicroUsd => {
  const parsed = parseDecimal(usd, 6);
  if (parsed === null) throw new RangeError(`Invalid price: ${usd}`);
  return parsed;
};

type FixedOptions = { minDecimals: number; maxDecimals: number };

const formatScaled = (value: bigint, scale: number, { minDecimals, maxDecimals }: FixedOptions): string => {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const factor = 10n ** BigInt(scale - maxDecimals);
  const rounded = maxDecimals < scale ? divRound(abs, factor) : abs * 10n ** BigInt(maxDecimals - scale);
  const base = 10n ** BigInt(maxDecimals);
  const whole = rounded / base;
  let fraction = maxDecimals > 0 ? (rounded % base).toString().padStart(maxDecimals, '0') : '';
  while (fraction.length > minDecimals && fraction.endsWith('0')) fraction = fraction.slice(0, -1);
  const text = groupThousands(whole.toString()) + (fraction ? `.${fraction}` : '');
  return negative ? `−${text}` : text;
};

/** "6,420.10" — drops shown with 2 decimals by default (en-US grouping, half-up). */
export const formatXrp = (drops: Drops, options: FixedOptions = { minDecimals: 2, maxDecimals: 2 }): string => formatScaled(drops, 6, options);
/** "6,420.10 XRP" */
export const formatXrpUnit = (drops: Drops, options?: FixedOptions): string => `${formatXrp(drops, options)} XRP`;
/** Withdraw "Recipient receives": up to 6 decimals, trailing zeros trimmed. */
export const formatXrpPrecise = (drops: Drops): string => formatScaled(drops, 6, { minDecimals: 0, maxDecimals: 6 });
/** "+1,250.00 XRP" / "−300.00 XRP" using the typographic minus from the design. */
export const formatSignedXrp = (drops: Drops): string => `${drops >= 0n ? '+' : '−'}${formatXrp(drops < 0n ? -drops : drops)} XRP`;

/** "$15,279.84" */
export const formatUsd = (cents: Cents): string => {
  const negative = cents < 0n;
  const text = `$${formatScaled(negative ? -cents : cents, 2, { minDecimals: 2, maxDecimals: 2 })}`;
  return negative ? `−${text}` : text;
};
/** "$2.3800" — prices under $10 use 4 decimals, as in the design. */
export const formatPrice = (micro: MicroUsd, decimals = 4): string => `$${formatScaled(micro, 6, { minDecimals: decimals, maxDecimals: decimals })}`;

/** USD value of an XRP amount at a price, rounded half-up to the cent. */
export const dropsToCents = (drops: Drops, price: MicroUsd): Cents =>
  // drops × micro-USD = 1e-12 USD; 1 cent = 1e10 of those.
  divRound(drops * price, 10_000_000_000n);

/** XRP needed to raise a USD amount at a price (rounded half-up to the drop). */
export const centsToDrops = (cents: Cents, price: MicroUsd): Drops => divRound(cents * 10_000_000_000n, price);

/** Splits "$15,279.84" into ["$15,279", ".84"] for the balance hero. */
export const splitUsd = (cents: Cents): [string, string] => {
  const text = formatUsd(cents);
  const dot = text.lastIndexOf('.');
  return [text.slice(0, dot), text.slice(dot)];
};

// ───────── Any asset (base units at the asset's ledger precision) ─────────

/** Parses user input like "0.0125" into base units of the asset. Null for invalid or over-precise input. */
export const parseUnits = (input: string, assetId: string): Units | null => parseDecimal(input, asset(assetId).decimals);

export const toUnits = (value: number | string, assetId: string): Units => {
  const parsed = parseUnits(String(value), assetId);
  if (parsed === null) throw new RangeError(`Invalid ${assetId} amount: ${value}`);
  return parsed;
};

/** "0.012500" style amount; defaults to the asset's display decimals (minimum 2, trailing zeros trimmed beyond that). */
export const formatUnits = (units: Units, assetId: string, options?: FixedOptions): string => {
  const d = asset(assetId).decimals;
  const max = Math.min(options?.maxDecimals ?? displayDecimals(assetId), d);
  return formatScaled(units, d, { minDecimals: Math.min(options?.minDecimals ?? 2, max), maxDecimals: max });
};
/** "0.0125 BTC" */
export const formatAmount = (units: Units, assetId: string, options?: FixedOptions): string => `${formatUnits(units, assetId, options)} ${assetId}`;
/** Full precision, trailing zeros trimmed: "0.00012345". */
export const formatUnitsPrecise = (units: Units, assetId: string): string => {
  const d = asset(assetId).decimals;
  return formatScaled(units, d, { minDecimals: 0, maxDecimals: d });
};
/** "+0.0125 BTC" / "−50.00 XRP". */
export const formatSignedAmount = (units: Units, assetId: string): string => `${units >= 0n ? '+' : '−'}${formatAmount(units < 0n ? -units : units, assetId)}`;

/** USD value of an amount of any asset, half-up to the cent: units × micro-USD ÷ 10^(decimals + 4). */
export const unitsToCents = (units: Units, price: MicroUsd, assetId: string): Cents => divRound(units * price, 10n ** BigInt(asset(assetId).decimals + 4));
/** Amount of an asset worth a USD amount at a price, half-up to the base unit. */
export const centsToUnits = (cents: Cents, price: MicroUsd, assetId: string): Units => divRound(cents * 10n ** BigInt(asset(assetId).decimals + 4), price);
/** Converts between two assets through their USD prices, half-up. */
export const convertUnits = (units: Units, from: { asset: string; price: MicroUsd }, to: { asset: string; price: MicroUsd }): Units =>
  divRound(units * from.price * 10n ** BigInt(asset(to.asset).decimals), to.price * 10n ** BigInt(asset(from.asset).decimals));

/** Prices: 2 decimals from $1, 4 below, more for sub-cent coins. */
export const formatAssetPrice = (micro: MicroUsd): string => {
  if (micro >= 1_000_000n) return formatPrice(micro, 2);
  if (micro >= 10_000n) return formatPrice(micro, 4);
  return formatPrice(micro, 6);
};
