import { Client } from 'xrpl';
import type { LedgerTx } from './deposits.ts';

/** What the worker needs from the XRP Ledger. */
export type Chain = {
  validatedLedger(): Promise<number>;
  /** Transactions touching `account` in [min, max], oldest first, all pages. */
  accountTx(account: string, min: number, max: number): AsyncIterable<LedgerTx>;
  /** A transaction by hash, or null if no server knows it yet. */
  tx(hash: string): Promise<LedgerTx | null>;
  /** XRP balance in drops; 0 for an unfunded account. */
  balance(account: string): Promise<bigint>;
  nodesInSync(): Promise<number>;
  onValidatedLedger(listener: (ledgerIndex: number) => void): void;
};

type RawAccountTx = { hash?: string; ledger_index: number; validated: boolean; tx_json?: LedgerTx['tx']; meta: LedgerTx['meta'] };

const toLedgerTx = (r: RawAccountTx): LedgerTx => ({
  hash: r.hash ?? '',
  ledgerIndex: r.ledger_index,
  validated: r.validated,
  tx: r.tx_json ?? { TransactionType: 'Unknown', Account: '' },
  meta: r.meta,
});

/**
 * Two rippled connections: requests go to the primary and fall back to the second endpoint when it is down.
 * Both subscribe to the ledger stream so a single outage never stops processing.
 */
export const xrplChain = async (endpoints: [string, string], log: (msg: string, extra?: unknown) => void): Promise<Chain> => {
  const clients = endpoints.map((url) => new Client(url, { connectionTimeout: 10_000 }));
  const listeners: ((i: number) => void)[] = [];
  let lastEmitted = 0;
  await Promise.allSettled(
    clients.map(async (c, i) => {
      c.on('ledgerClosed', (l: { ledger_index: number }) => {
        // Both nodes report the same ledgers; emit each index once.
        if (l.ledger_index > lastEmitted) {
          lastEmitted = l.ledger_index;
          for (const fn of listeners) fn(l.ledger_index);
        }
      });
      c.on('disconnected', (code: number) => log(`endpoint ${i} disconnected`, { code }));
      await c.connect();
      await c.request({ command: 'subscribe', streams: ['ledger'] });
    }),
  );
  if (!clients.some((c) => c.isConnected())) throw new Error('No XRPL endpoint reachable');

  const request = async <T>(fn: (c: Client) => Promise<T>): Promise<T> => {
    let last: unknown;
    for (const c of clients) {
      try {
        if (!c.isConnected()) await c.connect();
        return await fn(c);
      } catch (e) {
        last = e;
      }
    }
    throw last;
  };

  return {
    validatedLedger: () => request(async (c) => (await c.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger_index),
    accountTx: (account, min, max) => ({
      async *[Symbol.asyncIterator]() {
        let marker: unknown;
        do {
          const res = await request((c) =>
            c.request({
              command: 'account_tx',
              account,
              ledger_index_min: min,
              ledger_index_max: max,
              forward: true,
              limit: 200,
              ...(marker ? { marker } : {}),
            }),
          );
          for (const t of res.result.transactions) yield toLedgerTx(t as unknown as RawAccountTx);
          marker = res.result.marker;
        } while (marker);
      },
    }),
    tx: async (hash) => {
      try {
        const res = await request((c) => c.request({ command: 'tx', transaction: hash }));
        const r = res.result as unknown as RawAccountTx & { tx_json?: LedgerTx['tx'] };
        return toLedgerTx({ ...r, hash });
      } catch (e) {
        if (String((e as { data?: { error?: string } }).data?.error ?? e).includes('txnNotFound')) return null;
        throw e;
      }
    },
    balance: async (account) => {
      try {
        const res = await request((c) => c.request({ command: 'account_info', account, ledger_index: 'validated' }));
        return BigInt(res.result.account_data.Balance);
      } catch (e) {
        if (String((e as { data?: { error?: string } }).data?.error ?? e).includes('actNotFound')) return 0n;
        throw e;
      }
    },
    nodesInSync: async () => {
      const results = await Promise.allSettled(clients.map(async (c) => (await c.request({ command: 'server_info' })).result.info.server_state));
      return results.filter((r) => r.status === 'fulfilled' && ['full', 'proposing', 'validating'].includes(r.value)).length;
    },
    onValidatedLedger: (listener) => {
      listeners.push(listener);
    },
  };
};
