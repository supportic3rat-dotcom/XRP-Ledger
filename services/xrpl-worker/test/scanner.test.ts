import { createMockProviders } from '@xrp/providers';
import { describe, expect, it } from 'vitest';
import { MAX_RANGE, scanTo } from '../src/scanner.ts';
import { OMNIBUS, fakeChain, fakeStore, payment } from './fakes.ts';

const deps = (chain: ReturnType<typeof fakeChain>, store: ReturnType<typeof fakeStore>) => ({
  chain,
  store,
  screening: createMockProviders({ latencyMs: 0 }).screening,
  omnibus: new Set([OMNIBUS]),
  own: new Set([OMNIBUS]),
  log: () => undefined,
});

describe('scanTo', () => {
  it('replays from the stored cursor and advances it', async () => {
    const chain = fakeChain({ validated: 105, txs: [payment({ hash: 'A', ledger: 100 }), payment({ hash: 'B', ledger: 104, tag: 7 })] });
    const store = fakeStore({ cursor: 99 });
    expect(await scanTo(deps(chain, store), 105)).toBe(2);
    expect(store.rec.cursor).toBe(105);
    expect(chain.queried).toEqual([[100, 105]]);
  });
  it('replaying the same ledgers records nothing twice', async () => {
    const chain = fakeChain({ validated: 105, txs: [payment({ hash: 'A', ledger: 100 })] });
    const store = fakeStore({ cursor: 99 });
    await scanTo(deps(chain, store), 105);
    store.rec.cursor = 99; // e.g. crash before the cursor write
    await scanTo(deps(chain, store), 105);
    expect(store.rec.deposits.map((d) => d.hash)).toEqual(['A']);
  });
  it('moves the cursor in steps during a long catch-up', async () => {
    const chain = fakeChain({ validated: 99 + MAX_RANGE * 2 + 5 });
    const store = fakeStore({ cursor: 99 });
    await scanTo(deps(chain, store), 99 + MAX_RANGE * 2 + 5);
    expect(chain.queried.length).toBe(3);
  });
  it('starts at the current ledger when there is no cursor yet', async () => {
    const chain = fakeChain({ validated: 500 });
    const store = fakeStore({ cursor: null });
    expect(await scanTo(deps(chain, store), 500)).toBe(0);
    expect(store.rec.cursor).toBe(500);
  });
});
