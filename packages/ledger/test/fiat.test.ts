import { describe, expect, it } from 'vitest';
import { COUNTRIES, CURRENCY_NAMES, centsIn, currencyForCountry, formatFiat, formatFiatCompact, formatFiatPrice } from '../src/index.ts';

describe('local currency display', () => {
  it('maps a country to its currency', () => {
    expect(currencyForCountry('NG')).toBe('NGN');
    expect(currencyForCountry('GH')).toBe('GHS');
    expect(currencyForCountry('GB')).toBe('GBP');
    expect(currencyForCountry('DE')).toBe('EUR');
    expect(currencyForCountry('OTHER')).toBe('USD');
    expect(COUNTRIES.every((c) => c.currency in CURRENCY_NAMES)).toBe(true);
  });
  it('converts USD cents at a rate and formats with the local symbol', () => {
    expect(formatFiat(centsIn(150_000n, 1346.24), 'NGN')).toBe('₦2,019,360.00');
    expect(formatFiat(centsIn(1_000n, 0.75), 'GBP')).toBe('£7.50');
    expect(formatFiat(centsIn(100_000n, 152.3), 'JPY')).toBe('¥152,300');
    expect(formatFiat(-12.5, 'GHS')).toBe('−GH₵12.50');
  });
  it('formats coin prices and large figures in the local currency', () => {
    expect(formatFiatPrice(1_320_000n, 'NGN', 1346.24)).toBe('₦1,777.04');
    expect(formatFiatPrice(1_320_000n, 'USD', 1)).toBe('$1.32');
    expect(formatFiatPrice(150_000n, 'USD', 1)).toBe('$0.1500');
    expect(formatFiatCompact(2.3e12, 'EUR')).toBe('€2.3T');
  });
});
