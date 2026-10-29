import type { Cents, MicroUsd } from '@xrp/types';

/**
 * Display amounts in a customer's own currency. Money is always held and computed in USD (bigint cents and
 * micro-USD); these convert only for showing, at a USD → currency rate. Never feed the results back into money maths.
 */
const SYMBOLS: Readonly<Record<string, string>> = {
  USD: '$',
  NGN: '₦',
  GBP: '£',
  EUR: '€',
  GHS: 'GH₵',
  KES: 'KSh ',
  ZAR: 'R',
  INR: '₹',
  JPY: '¥',
  CNY: 'CN¥',
  KRW: '₩',
  CAD: 'CA$',
  AUD: 'A$',
  NZD: 'NZ$',
  BRL: 'R$',
  MXN: 'MX$',
  CHF: 'CHF ',
  TRY: '₺',
  PHP: '₱',
  VND: '₫',
  THB: '฿',
  ILS: '₪',
  UAH: '₴',
  RUB: '₽',
  PLN: 'zł ',
  EGP: 'E£',
  PKR: 'Rs ',
  BDT: '৳',
  XOF: 'CFA ',
  XAF: 'FCFA ',
  HKD: 'HK$',
  SGD: 'S$',
  AED: 'AED ',
  SAR: 'SAR ',
};

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'UGX', 'RWF', 'XOF', 'XAF', 'KMF', 'GNF', 'PYG', 'CLP', 'ISK', 'BIF', 'DJF', 'VUV', 'XPF', 'MGA', 'IDR', 'IRR', 'LAK', 'SLE']);

export const fiatSymbol = (code: string): string => SYMBOLS[code] ?? `${code} `;
export const fiatDecimals = (code: string): number => (ZERO_DECIMAL.has(code) ? 0 : 2);

const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const fixed = (value: number, decimals: number): string => {
  const [whole, frac] = Math.abs(value).toFixed(decimals).split('.');
  return group(whole ?? '0') + (frac ? `.${frac}` : '');
};

/** "₦1,234,567.89" from a value in whole units of `code`. */
export const formatFiat = (value: number, code: string, decimals = fiatDecimals(code)): string =>
  `${value < 0 ? '−' : ''}${fiatSymbol(code)}${fixed(value, decimals)}`;

/** USD cents → `code`, at `rate` units of `code` per USD. */
export const centsIn = (cents: Cents, rate: number): number => (Number(cents) / 100) * rate;

/** A price in `code`: 2 decimals from 1, 4 below, 6 for sub-cent coins (none for large zero-decimal prices). */
export const formatFiatPrice = (micro: MicroUsd, code: string, rate: number): string => {
  const value = (Number(micro) / 1_000_000) * rate;
  const base = fiatDecimals(code);
  const decimals = value >= 1 ? (base === 0 && value >= 100 ? 0 : 2) : value >= 0.01 ? 4 : 6;
  return formatFiat(value, code, decimals);
};

/** "₦2.3T" — market caps and volumes. */
export const formatFiatCompact = (value: number, code: string): string => {
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [n, s] of units) if (value >= n) return `${fiatSymbol(code)}${(value / n).toFixed(value / n >= 100 ? 0 : 1)}${s}`;
  return `${fiatSymbol(code)}${value.toFixed(0)}`;
};
