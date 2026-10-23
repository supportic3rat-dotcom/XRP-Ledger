import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type WithdrawalRow = {
  id: string;
  ref: string;
  status: 'approved' | 'submitted';
  amountDrops: bigint;
  feeDrops: bigint;
  networkFeeDrops: bigint;
  destination: string;
  destinationTag: number | null;
  meta: Record<string, string>;
};

/** Everything the worker reads and writes in Postgres. All money writes go through SQL functions. */
export type Store = {
  wallets(): Promise<{ id: string; tier: string; address: string }[]>;
  cursor(): Promise<number | null>;
  setCursor(ledgerIndex: number): Promise<void>;
  recordDeposit(d: { hash: string; ledgerIndex: number; tag: number | null; amountDrops: bigint; from: string; screeningHold: boolean }): Promise<void>;
  withdrawals(status: 'approved' | 'submitted'): Promise<WithdrawalRow[]>;
  markSubmitted(id: string, transferId: string, lastLedger: number, txHash: string | null): Promise<void>;
  rememberHash(id: string, txHash: string): Promise<void>;
  markValidated(id: string, hash: string, ledgerIndex: number, feeDrops: bigint): Promise<void>;
  markFailed(id: string, reason: string, hash?: string): Promise<void>;
  heartbeat(worker: string, validatedLedger: number, nodesInSync: number): Promise<void>;
  setChainBalance(address: string, drops: bigint, ledgerIndex: number): Promise<void>;
  externalWallets(): Promise<{ id: string; address: string }[]>;
  setExternalBalance(id: string, drops: bigint): Promise<void>;
  insertPrice(asset: string, priceMicro: bigint, changeBps: number, source: string): Promise<void>;
  /** Scheduled upkeep through public.run_job (service role only). */
  runJob(job: string): Promise<void>;
};

const must = <T>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

export const supabaseStore = (url: string, serviceRoleKey: string): Store => {
  const db: SupabaseClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    must(await db.rpc(fn, args));
  };
  return {
    wallets: async () => must(await db.from('custody_wallets').select('id, tier, address')) ?? [],
    cursor: async () => {
      const row = must(await db.from('chain_cursor').select('last_ledger_index').eq('id', 'omnibus').maybeSingle()) as { last_ledger_index: number } | null;
      return row ? Number(row.last_ledger_index) : null;
    },
    setCursor: async (i) => {
      must(await db.from('chain_cursor').upsert({ id: 'omnibus', last_ledger_index: i, updated_at: new Date().toISOString() }));
    },
    recordDeposit: (d) =>
      rpc('chain_record_deposit', {
        p_hash: d.hash,
        p_ledger_index: d.ledgerIndex,
        p_tag: d.tag,
        p_amount_drops: d.amountDrops.toString(),
        p_from: d.from,
        p_screening_hold: d.screeningHold,
      }),
    withdrawals: async (status) => {
      const rows = (must(
        await db
          .from('transactions')
          .select('id, ref, status, amount_drops, fee_drops, network_fee_drops, counterparty, destination_tag, meta')
          .eq('kind', 'withdrawal')
          .eq('asset', 'XRP') // other assets are sent by staff and marked sent in the console
          .eq('status', status)
          .order('created_at')
          .limit(50),
      ) ?? []) as Record<string, unknown>[];
      return rows.map((r) => ({
        id: String(r.id),
        ref: String(r.ref),
        status,
        amountDrops: BigInt(String(r.amount_drops)),
        feeDrops: BigInt(String(r.fee_drops)),
        networkFeeDrops: BigInt(String(r.network_fee_drops)),
        destination: String(r.counterparty),
        destinationTag: r.destination_tag === null ? null : Number(r.destination_tag),
        meta: (r.meta as Record<string, string>) ?? {},
      }));
    },
    markSubmitted: (id, transferId, lastLedger, txHash) =>
      rpc('chain_withdrawal_submitted', { p_tx: id, p_transfer_id: transferId, p_last_ledger: lastLedger, p_tx_hash: txHash }),
    rememberHash: (id, txHash) => rpc('chain_withdrawal_hash', { p_tx: id, p_tx_hash: txHash }),
    markValidated: (id, hash, ledgerIndex, feeDrops) =>
      rpc('chain_withdrawal_validated', { p_tx: id, p_hash: hash, p_ledger_index: ledgerIndex, p_fee_drops: feeDrops.toString() }),
    markFailed: (id, reason, hash) => rpc('chain_withdrawal_failed', { p_tx: id, p_reason: reason, p_hash: hash ?? null }),
    heartbeat: async (worker, validatedLedger, nodesInSync) => {
      must(await db.from('worker_heartbeat').upsert({ worker, validated_ledger: validatedLedger, nodes_in_sync: nodesInSync, at: new Date().toISOString() }));
    },
    setChainBalance: async (address, drops, ledgerIndex) => {
      must(await db.from('chain_balances').upsert({ address, balance_drops: drops.toString(), ledger_index: ledgerIndex, at: new Date().toISOString() }));
    },
    externalWallets: async () =>
      (must(await db.from('external_wallets').select('id, address').is('removed_at', null)) ?? []) as { id: string; address: string }[],
    setExternalBalance: async (id, drops) => {
      must(await db.from('external_wallets').update({ balance_drops: drops.toString(), balance_at: new Date().toISOString() }).eq('id', id));
    },
    insertPrice: async (asset, priceMicro, changeBps, source) => {
      must(await db.from('prices').insert({ asset, usd_micro: priceMicro.toString(), change_bps: changeBps, source }));
    },
    runJob: (job) => rpc('run_job', { p_job: job }),
  };
};
