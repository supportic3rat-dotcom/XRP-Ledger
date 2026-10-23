import { describe, expect, it } from 'vitest';
import {
  canTransition,
  dropsToCents,
  exchangeEstimate,
  formatBps,
  formatPrice,
  formatSignedXrp,
  formatUsd,
  formatXrp,
  formatXrpPrecise,
  isBalanced,
  isXrplAddress,
  journalFor,
  LIQUIDATION_BPS,
  ltvBps,
  MARGIN_CALL_BPS,
  needsTwoApprovals,
  parseUsd,
  parseXrp,
  simpleInterest,
  splitUsd,
  thresholdPrice,
  usdToMicro,
  withdrawalReceive,
  xrpToDrops,
} from '../src';

const PRICE = usdToMicro('2.38');

describe('design sample figures', () => {
  it('values balances at $2.38 exactly as Home shows them', () => {
    expect(formatUsd(dropsToCents(xrpToDrops('6420.10'), PRICE))).toBe('$15,279.84');
    expect(formatUsd(dropsToCents(xrpToDrops('4170.10'), PRICE))).toBe('$9,924.84');
    expect(formatUsd(dropsToCents(xrpToDrops('1500'), PRICE))).toBe('$3,570.00');
    expect(formatUsd(dropsToCents(xrpToDrops('750'), PRICE))).toBe('$1,785.00');
    expect(formatUsd(dropsToCents(xrpToDrops('1.97'), PRICE))).toBe('$4.69');
    expect(splitUsd(152_984n * 10n)).toEqual(['$15,298', '.40']);
  });

  it('computes LN-PROTO-0007 risk figures', () => {
    const owed = 60_493n;
    const coll = xrpToDrops('750');
    expect(formatBps(ltvBps(owed, coll, PRICE))).toBe('33.9%');
    expect(formatPrice(thresholdPrice(owed, coll, MARGIN_CALL_BPS))).toBe('$1.2409');
    expect(formatPrice(thresholdPrice(owed, coll, LIQUIDATION_BPS))).toBe('$1.0082');
  });

  it('matches withdrawal and exchange math', () => {
    expect(formatXrpPrecise(withdrawalReceive(xrpToDrops('300')))).toBe('299.749988');
    expect(needsTwoApprovals(xrpToDrops('1250'))).toBe(true);
    expect(needsTwoApprovals(xrpToDrops('1000'))).toBe(false);
    const est = exchangeEstimate(xrpToDrops('500'), PRICE);
    expect(formatUsd(est.receive)).toBe('$1,176.60');
    expect(formatUsd(est.fee)).toBe('$11.90');
  });

  it('estimates Earn rewards with simple interest', () => {
    const gross = simpleInterest(xrpToDrops('1000'), 300, 90);
    expect(formatXrp(gross, { minDecimals: 2, maxDecimals: 4 })).toBe('7.3973');
  });
});

describe('parsing and formatting', () => {
  it('parses without floats and rejects over-precision', () => {
    expect(parseXrp('1,250.5')).toBe(1_250_500_000n);
    expect(parseXrp('0.0000001')).toBeNull();
    expect(parseXrp('abc')).toBeNull();
    expect(parseUsd('604.93')).toBe(60_493n);
  });
  it('formats signed amounts with a typographic minus', () => {
    expect(formatSignedXrp(-xrpToDrops('300'))).toBe('−300.00 XRP');
    expect(formatSignedXrp(xrpToDrops('1250'))).toBe('+1,250.00 XRP');
    expect(formatPrice(usdToMicro('2.3742'))).toBe('$2.3742');
  });
  it('validates XRPL addresses', () => {
    expect(isXrplAddress('rProtoRecipient4xQb7mKcV9tYwZ2hN')).toBe(true);
    expect(isXrplAddress('bc1q-not-xrpl')).toBe(false);
  });
});

describe('state machines and journal', () => {
  it('only allows defined transitions', () => {
    expect(canTransition('withdrawal', 'requested', 'in_review')).toBe(true);
    expect(canTransition('withdrawal', 'requested', 'validated')).toBe(false);
    expect(canTransition('deposit', 'credited', 'detected')).toBe(false);
  });
  it('produces balanced journal entries', () => {
    const amt = xrpToDrops('300.25');
    const fee = xrpToDrops('0.249988');
    for (const [kind, status] of [
      ['deposit', 'credited'], ['deposit', 'no_tag'], ['withdrawal', 'requested'], ['withdrawal', 'validated'],
      ['withdrawal', 'rejected'], ['exchange', 'accepted'], ['exchange', 'sold'], ['yield_allocate', 'requested'],
      ['yield_allocate', 'confirmed'], ['yield_reward', 'credited'], ['loan', 'collateral_locked'], ['loan', 'repaid'],
    ] as const) {
      const lines = journalFor(kind, status, amt, fee);
      expect(lines.length).toBeGreaterThan(0);
      expect(isBalanced(lines)).toBe(true);
    }
  });
});
