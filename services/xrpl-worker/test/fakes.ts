import type { CustodyProvider, CustodyTransfer } from '@xrp/providers';
import type { Chain } from '../src/chain.ts';
import type { LedgerTx } from '../src/deposits.ts';
import type { Store, WithdrawalRow } from '../src/store.ts';

export const OMNIBUS = 'rHotProtoKcV9tYwZ2hNa19xQb';
export const WARM = 'rWarmProtoKcV9tYwZ2hNb24mKc';
export const SENDER = 'rSendrXk3PaKcV9tYwZ2hNproto9Qa';
export const RECIPIENT = 'rRecipXk3PaKcV9tYwZ2hNproto7Hd';

export const payment = (
  o: Partial<{ hash: string; ledger: number; from: string; to: string; tag: number; delivered: unknown; result: string; validated: boolean; fee: string }> = {},
): LedgerTx => ({
  hash: o.hash ?? 'H1',
  ledgerIndex: o.ledger ?? 100,
  validated: o.validated ?? true,
  tx: {
    TransactionType: 'Payment',
    Account: o.from ?? SENDER,
    Destination: o.to ?? OMNIBUS,
    Fee: o.fee ?? '12',
    ...(o.tag === undefined ? {} : { DestinationTag: o.tag }),
  },
  meta: { TransactionResult: o.result ?? 'tesSUCCESS', delivered_amount: 'delivered' in o ? o.delivered : '25000000' },
});

export const fakeChain = (opts: { validated: number; txs?: LedgerTx[]; byHash?: Record<string, LedgerTx> }): Chain & { queried: [number, number][] } => {
  const queried: [number, number][] = [];
  return {
    queried,
    validatedLedger: async () => opts.validated,
    accountTx: (_account, min, max) => ({
      async *[Symbol.asyncIterator]() {
        queried.push([min, max]);
        for (const t of opts.txs ?? []) if (t.ledgerIndex >= min && t.ledgerIndex <= max) yield t;
      },
    }),
    tx: async (hash) => opts.byHash?.[hash] ?? null,
    balance: async () => 0n,
    nodesInSync: async () => 2,
    onValidatedLedger: () => undefined,
  };
};

export type Recorded = { deposits: Parameters<Store['recordDeposit']>[0][]; cursor: number | null; events: string[] };

export const fakeStore = (opts: { cursor?: number | null; withdrawals?: WithdrawalRow[] } = {}): Store & { rec: Recorded } => {
  const rec: Recorded = { deposits: [], cursor: opts.cursor === undefined ? 99 : opts.cursor, events: [] };
  const rows = opts.withdrawals ?? [];
  const seen = new Set<string>();
  return {
    rec,
    wallets: async () => [],
    cursor: async () => rec.cursor,
    setCursor: async (i) => {
      rec.cursor = i;
    },
    recordDeposit: async (d) => {
      if (seen.has(d.hash)) return; // chain_record_deposit is idempotent by hash
      seen.add(d.hash);
      rec.deposits.push(d);
    },
    withdrawals: async (status) => rows.filter((r) => r.status === status),
    markSubmitted: async (id, transferId, last, hash) => {
      rec.events.push(`submitted:${id}:${transferId}:${last}:${hash}`);
    },
    rememberHash: async (id, hash) => {
      rec.events.push(`hash:${id}:${hash}`);
    },
    markValidated: async (id, hash, ledger, fee) => {
      rec.events.push(`validated:${id}:${hash}:${ledger}:${fee}`);
    },
    markFailed: async (id, reason) => {
      rec.events.push(`failed:${id}:${reason}`);
    },
    heartbeat: async () => undefined,
    setChainBalance: async () => undefined,
    externalWallets: async () => [],
    setExternalBalance: async () => undefined,
    insertPrice: async (asset, micro, bps) => {
      rec.events.push(`price:${asset}:${micro}:${bps}`);
    },
    runJob: async (job) => {
      rec.events.push(`job:${job}`);
    },
    xrpMode: async () => 'automatic',
  };
};

export const withdrawal = (o: Partial<WithdrawalRow> = {}): WithdrawalRow => ({
  id: 'w1',
  ref: 'WD-002101',
  status: 'approved',
  amountDrops: 300_000_000n,
  feeDrops: 250_000n,
  networkFeeDrops: 12n,
  destination: RECIPIENT,
  destinationTag: 10293847,
  meta: {},
  ...o,
});

export const fakeCustody = (transfer: Partial<CustodyTransfer> = {}): CustodyProvider & { requests: unknown[] } => {
  const requests: unknown[] = [];
  return {
    requests,
    health: async () => ({ status: 'operational', note: '' }),
    listWallets: async () => [],
    getBalances: async () => ({ totalDrops: 0n }),
    requestWithdrawal: async (input) => {
      requests.push(input);
      return { id: 'tr-1', status: 'submitted', ledgerHash: 'HW1', ledgerIndex: null, ...transfer };
    },
    getTransfer: async (id) => ({ id, status: 'submitted', ledgerHash: 'HW1', ledgerIndex: null, ...transfer }),
  };
};
