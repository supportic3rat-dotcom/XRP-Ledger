import { describe, expect, it } from 'vitest';
import { recordPrice } from '../src/upkeep.ts';
import { LEDGER_WINDOW, confirmSubmitted, receiveDrops, submitApproved } from '../src/withdrawals.ts';
import { RECIPIENT, fakeChain, fakeCustody, fakeStore, payment, withdrawal } from './fakes.ts';

const log = () => undefined;

describe('withdrawals', () => {
  it('sends amount minus fees with a LastLedgerSequence', async () => {
    const custody = fakeCustody();
    const store = fakeStore({ withdrawals: [withdrawal()] });
    await submitApproved({ chain: fakeChain({ validated: 1000 }), store, custody, log });
    expect(receiveDrops(withdrawal())).toBe(299_749_988n);
    expect(custody.requests[0]).toMatchObject({ idempotencyKey: 'w1', amountDrops: 299_749_988n, lastLedgerSequence: 1000 + LEDGER_WINDOW });
    expect(store.rec.events).toEqual([`submitted:w1:tr-1:${1000 + LEDGER_WINDOW}:HW1`]);
  });

  it('completes only on tesSUCCESS in a validated ledger, booking the actual fee', async () => {
    const sub = withdrawal({ status: 'submitted', meta: { transfer_id: 'tr-1', tx_hash: 'HW1', last_ledger_sequence: '1020' } });
    const ok = payment({ hash: 'HW1', ledger: 1005, to: RECIPIENT, delivered: '299749988', fee: '15' });
    const store = fakeStore({ withdrawals: [sub] });
    await confirmSubmitted({ chain: fakeChain({ validated: 1006, byHash: { HW1: ok } }), store, custody: fakeCustody(), log });
    expect(store.rec.events).toEqual(['validated:w1:HW1:1005:15']);
  });

  it('waits while the transaction is known but not yet validated', async () => {
    const sub = withdrawal({ status: 'submitted', meta: { tx_hash: 'HW1', last_ledger_sequence: '1020' } });
    const store = fakeStore({ withdrawals: [sub] });
    await confirmSubmitted({
      chain: fakeChain({ validated: 1010, byHash: { HW1: payment({ hash: 'HW1', validated: false }) } }),
      store,
      custody: fakeCustody(),
      log,
    });
    expect(store.rec.events).toEqual([]);
  });

  it('fails a validated tec result and an expired one', async () => {
    const tec = withdrawal({ id: 'a', status: 'submitted', meta: { tx_hash: 'HA', last_ledger_sequence: '1020' } });
    const late = withdrawal({ id: 'b', status: 'submitted', meta: { tx_hash: 'HB', last_ledger_sequence: '1020' } });
    const store = fakeStore({ withdrawals: [tec, late] });
    const chain = fakeChain({ validated: 1021, byHash: { HA: payment({ hash: 'HA', result: 'tecNO_DST_INSUF_XRP' }) } });
    await confirmSubmitted({ chain, store, custody: fakeCustody(), log });
    expect(store.rec.events).toEqual(['failed:a:Ledger result tecNO_DST_INSUF_XRP', 'failed:b:Expired: not in a validated ledger by 1020']);
  });

  it('fails when custody refuses, without submitting', async () => {
    const store = fakeStore({ withdrawals: [withdrawal()] });
    await submitApproved({ chain: fakeChain({ validated: 1000 }), store, custody: fakeCustody({ status: 'failed' }), log });
    expect(store.rec.events).toEqual(['failed:w1:[Custody provider] refused the transfer']);
  });
});

describe('recordPrice', () => {
  it('stores the 24h change in whole basis points without floats', async () => {
    const store = fakeStore();
    const feed = {
      getPrice: async () => ({ priceMicro: 2_380_000n, at: '', source: '[Market data provider]' }),
      getHistory: async () => [{ at: '0', priceMicro: 2_300_000n }],
    };
    await recordPrice(feed, store);
    expect(store.rec.events).toEqual(['price:XRP:2380000:348']);
  });
});
