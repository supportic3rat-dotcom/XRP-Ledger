import { describe, expect, it } from 'vitest';
import { classifyDeposit } from '../src/deposits.ts';
import { OMNIBUS, WARM, payment } from './fakes.ts';

const omnibus = new Set([OMNIBUS]);
const own = new Set([OMNIBUS, WARM]);

describe('classifyDeposit', () => {
  it('credits a validated tesSUCCESS XRP payment by its delivered amount and tag', () => {
    expect(classifyDeposit(payment({ tag: 48201937 }), omnibus, own)).toEqual({
      kind: 'deposit',
      hash: 'H1',
      ledgerIndex: 100,
      amountDrops: 25_000_000n,
      tag: 48201937,
      from: expect.any(String),
    });
  });
  it('keeps a missing tag as null so it goes to suspense', () => {
    expect(classifyDeposit(payment(), omnibus, own)).toMatchObject({ kind: 'deposit', tag: null });
  });
  it.each([
    ['not validated', payment({ validated: false })],
    ['failed result', payment({ result: 'tecUNFUNDED_PAYMENT' })],
    ['issued currency', payment({ delivered: { currency: 'USD', value: '10', issuer: 'rX' } })],
    ['delivered amount unavailable', payment({ delivered: 'unavailable' })],
    ['payment elsewhere', payment({ to: 'rSomeoneElseXk3PaKcV9tYwZ2hN' })],
    ['internal sweep', payment({ from: WARM })],
  ])('ignores %s', (_name, tx) => {
    expect(classifyDeposit(tx, omnibus, own).kind).toBe('ignore');
  });
  it('uses delivered_amount, not Amount, so a partial payment cannot overstate a deposit', () => {
    const t = payment({ delivered: '1' });
    (t.tx as Record<string, unknown>).Amount = '100000000000';
    expect(classifyDeposit(t, omnibus, own)).toMatchObject({ amountDrops: 1n });
  });
});
