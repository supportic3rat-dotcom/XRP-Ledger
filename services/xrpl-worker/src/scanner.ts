import type { ScreeningProvider } from '@xrp/providers';
import type { Chain } from './chain.ts';
import { classifyDeposit } from './deposits.ts';
import type { Store } from './store.ts';

/** Ledgers processed per step, so the cursor keeps moving during a long replay. */
export const MAX_RANGE = 1_000;

export type ScanDeps = {
  chain: Chain;
  store: Store;
  screening: ScreeningProvider;
  omnibus: ReadonlySet<string>;
  own: ReadonlySet<string>;
  log: (m: string, x?: unknown) => void;
};

/**
 * Processes every validated ledger after the cursor up to `upTo`, then advances the cursor. On restart it
 * resumes from the stored cursor, so no deposit is missed; recording is idempotent by hash, so a replayed
 * ledger never credits twice. Returns the number of deposits recorded.
 */
export const scanTo = async (deps: ScanDeps, upTo: number): Promise<number> => {
  const cursor = await deps.store.cursor();
  if (cursor === null) {
    deps.log('no chain cursor; starting from the current validated ledger', { upTo });
    await deps.store.setCursor(upTo);
    return 0;
  }
  let recorded = 0;
  for (let from = cursor + 1; from <= upTo; from += MAX_RANGE) {
    const to = Math.min(upTo, from + MAX_RANGE - 1);
    for (const address of deps.omnibus) {
      for await (const t of deps.chain.accountTx(address, from, to)) {
        const d = classifyDeposit(t, deps.omnibus, deps.own);
        if (d.kind !== 'deposit') continue;
        const screening = await deps.screening.screenTransfer({ address: d.from, amountDrops: d.amountDrops, direction: 'in' });
        await deps.store.recordDeposit({ ...d, screeningHold: screening.hold });
        deps.log('deposit recorded', { hash: d.hash, ledger: d.ledgerIndex, tag: d.tag, drops: d.amountDrops.toString() });
        recorded++;
      }
    }
    await deps.store.setCursor(to);
  }
  return recorded;
};
