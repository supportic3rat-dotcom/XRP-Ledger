import type { CustodyProvider } from '@xrp/providers';
import type { Chain } from './chain.ts';
import type { Store, WithdrawalRow } from './store.ts';

/** LastLedgerSequence = current validated + this (≈ 1–1.5 minutes), so an unconfirmed payment expires cleanly. */
export const LEDGER_WINDOW = 20;

export type WithdrawDeps = { chain: Chain; store: Store; custody: CustodyProvider; log: (m: string, x?: unknown) => void };

/** Fees come out of the amount: the recipient gets amount − platform fee − network fee (300 → 299.749988). */
export const receiveDrops = (w: Pick<WithdrawalRow, 'amountDrops' | 'feeDrops' | 'networkFeeDrops'>): bigint => w.amountDrops - w.feeDrops - w.networkFeeDrops;

/** Hands each approved withdrawal to the custody provider to sign and submit. */
export const submitApproved = async (deps: WithdrawDeps): Promise<void> => {
  for (const w of await deps.store.withdrawals('approved')) {
    const amount = receiveDrops(w);
    if (amount <= 0n) {
      await deps.store.markFailed(w.id, 'Amount does not cover fees');
      continue;
    }
    const lastLedger = (await deps.chain.validatedLedger()) + LEDGER_WINDOW;
    const transfer = await deps.custody.requestWithdrawal({
      idempotencyKey: w.id,
      destination: w.destination,
      destinationTag: w.destinationTag,
      amountDrops: amount,
      lastLedgerSequence: lastLedger,
    });
    if (transfer.status === 'failed') {
      await deps.store.markFailed(w.id, '[Custody provider] refused the transfer');
      continue;
    }
    await deps.store.markSubmitted(w.id, transfer.id, lastLedger, transfer.ledgerHash);
    deps.log('withdrawal submitted', { ref: w.ref, transfer: transfer.id, lastLedger });
  }
};

/**
 * Settles submitted withdrawals from the ledger itself: `validated` only for tesSUCCESS in a validated ledger;
 * a validated failure (tec…) or a passed LastLedgerSequence fails it, and the hold returns to available.
 */
export const confirmSubmitted = async (deps: WithdrawDeps): Promise<void> => {
  const pending = await deps.store.withdrawals('submitted');
  if (pending.length === 0) return;
  const validatedLedger = await deps.chain.validatedLedger();
  for (const w of pending) {
    let hash: string | null = w.meta.tx_hash ?? null;
    if (!hash && w.meta.transfer_id) {
      const t = await deps.custody.getTransfer(w.meta.transfer_id);
      if (t.status === 'failed') {
        await deps.store.markFailed(w.id, '[Custody provider] reported a failure');
        continue;
      }
      if (t.ledgerHash) {
        hash = t.ledgerHash;
        await deps.store.rememberHash(w.id, hash);
      }
    }
    const lastLedger = Number(w.meta.last_ledger_sequence ?? 0);
    const onChain = hash ? await deps.chain.tx(hash) : null;
    if (onChain?.validated && typeof onChain.meta === 'object') {
      if (onChain.meta.TransactionResult === 'tesSUCCESS') {
        const delivered = typeof onChain.meta.delivered_amount === 'string' ? BigInt(onChain.meta.delivered_amount) : null;
        if (delivered !== receiveDrops(w) || onChain.tx.Destination !== w.destination) {
          deps.log('ALERT withdrawal delivered differs from request', { ref: w.ref, delivered: String(delivered), expected: receiveDrops(w).toString() });
        }
        await deps.store.markValidated(w.id, onChain.hash, onChain.ledgerIndex, BigInt(onChain.tx.Fee ?? '0'));
        deps.log('withdrawal validated', { ref: w.ref, ledger: onChain.ledgerIndex });
      } else {
        await deps.store.markFailed(w.id, `Ledger result ${onChain.meta.TransactionResult}`, onChain.hash);
      }
      continue;
    }
    if (lastLedger > 0 && validatedLedger > lastLedger) {
      await deps.store.markFailed(w.id, `Expired: not in a validated ledger by ${lastLedger}`, hash ?? undefined);
      deps.log('withdrawal expired', { ref: w.ref, lastLedger });
    }
  }
};
