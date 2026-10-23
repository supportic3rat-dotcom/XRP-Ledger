/** A transaction as account_tx returns it (API v2), reduced to what deposit detection reads. */
export type LedgerTx = {
  hash: string;
  ledgerIndex: number;
  validated: boolean;
  tx: { TransactionType: string; Account: string; Destination?: string; DestinationTag?: number; Fee?: string };
  meta: { TransactionResult: string; delivered_amount?: unknown } | string;
};

export type DepositDecision =
  { kind: 'deposit'; hash: string; ledgerIndex: number; amountDrops: bigint; tag: number | null; from: string } | { kind: 'ignore'; reason: string };

/**
 * Decides whether a ledger transaction is a customer deposit. Only validated, tesSUCCESS XRP payments into an
 * omnibus address count, and the amount is `delivered_amount` (never `Amount`, which a partial payment can fake).
 * Payments between our own wallets are sweeps, not deposits.
 */
export const classifyDeposit = (t: LedgerTx, omnibus: ReadonlySet<string>, ownWallets: ReadonlySet<string>): DepositDecision => {
  if (!t.validated) return { kind: 'ignore', reason: 'not validated' };
  if (t.tx.TransactionType !== 'Payment') return { kind: 'ignore', reason: 'not a payment' };
  if (!t.tx.Destination || !omnibus.has(t.tx.Destination)) return { kind: 'ignore', reason: 'not to omnibus' };
  if (ownWallets.has(t.tx.Account)) return { kind: 'ignore', reason: 'internal sweep' };
  if (typeof t.meta !== 'object') return { kind: 'ignore', reason: 'no metadata' };
  if (t.meta.TransactionResult !== 'tesSUCCESS') return { kind: 'ignore', reason: t.meta.TransactionResult };
  const delivered = t.meta.delivered_amount;
  if (typeof delivered !== 'string' || !/^\d+$/.test(delivered)) return { kind: 'ignore', reason: 'not XRP or delivered amount unavailable' };
  const amountDrops = BigInt(delivered);
  if (amountDrops <= 0n) return { kind: 'ignore', reason: 'zero amount' };
  return { kind: 'deposit', hash: t.hash, ledgerIndex: t.ledgerIndex, amountDrops, tag: t.tx.DestinationTag ?? null, from: t.tx.Account };
};
