import { describe, expect, it } from 'vitest';
import { centsOf, formatUnits, formatUnitsPrecise, parseUnits, priceText, usdCents } from '@/lib/money';

describe('integer money for the dashboard', () => {
  it('formats units at any scale, half-up', () => {
    expect(formatUnits(6_420_100_000n, 6, 2)).toBe('6,420.10');
    expect(formatUnits(7_210_000n, 8, 5)).toBe('0.07210');
    expect(formatUnits(614_200_000_000_000_000n, 18, 4)).toBe('0.6142');
    expect(formatUnits(5n, 6, 5)).toBe('0.00001');
  });
  it('parses typed amounts without floats', () => {
    expect(parseUnits('1,250.5', 6)).toBe(1_250_500_000n);
    expect(parseUnits('0.0000001', 6)).toBeNull();
    expect(parseUnits('abc', 6)).toBeNull();
  });
  it('values holdings in cents (XRP, BTC, ETH)', () => {
    expect(usdCents(centsOf(6_420_100_000n, 6, 2_380_000n))).toBe('$15,279.84');
    expect(usdCents(centsOf(7_210_000n, 8, 98_000_000_000n))).toBe('$7,065.80');
    expect(usdCents(centsOf(614_200_000_000_000_000n, 18, 3_801_330_000n))).toBe('$2,334.78');
  });
  it('shows the recipient amount at full precision when fees come out of it', () => {
    expect(formatUnitsPrecise(300_000_000n - 250_012n, 6, 2)).toBe('299.749988');
    expect(formatUnitsPrecise(300_000_000n, 6, 2)).toBe('300.00');
  });
  it('prices under $10 use 4 decimals', () => {
    expect(priceText(2_380_000n)).toBe('$2.3800');
    expect(priceText(98_000_000_000n)).toBe('$98,000.00');
  });
});
