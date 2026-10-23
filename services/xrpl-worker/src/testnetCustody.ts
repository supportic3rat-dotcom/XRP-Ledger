import type { CustodyProvider, CustodyTransfer } from '@xrp/providers';
import { Client, convertStringToHex, type Payment, Wallet } from 'xrpl';

const MEMO_TYPE = convertStringToHex('withdrawal');
const DEDUPE_LEDGERS = 2_000;

/**
 * Testnet-only stand-in for the custody provider: signs withdrawals with a funded testnet hot wallet so the
 * full flow runs end to end. In production signing happens only in the provider's MPC/HSM; `loadConfig`
 * refuses a seed on mainnet.
 */
export const testnetCustody = async (endpoint: string, seed: string): Promise<CustodyProvider> => {
  const client = new Client(endpoint);
  await client.connect();
  const wallet = Wallet.fromSeed(seed);

  /** The custody idempotency key travels as a memo, so a crash between submit and record never pays twice. */
  const alreadySent = async (key: string): Promise<string | null> => {
    const memo = convertStringToHex(key).toUpperCase();
    const validated = (await client.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger_index;
    const res = await client.request({ command: 'account_tx', account: wallet.address, ledger_index_min: Math.max(1, validated - DEDUPE_LEDGERS), limit: 400 });
    for (const t of res.result.transactions) {
      const memos = (t.tx_json as { Memos?: { Memo: { MemoData?: string } }[] } | undefined)?.Memos ?? [];
      if (memos.some((m) => m.Memo.MemoData?.toUpperCase() === memo)) return t.hash ?? null;
    }
    return null;
  };

  const balance = async (): Promise<bigint> =>
    BigInt((await client.request({ command: 'account_info', account: wallet.address, ledger_index: 'validated' })).result.account_data.Balance);

  return {
    health: async () => ({ status: client.isConnected() ? 'operational' : 'outage', note: 'Testnet signer' }),
    listWallets: async () => [{ id: 'hot', tier: 'hot', address: wallet.address, balanceDrops: await balance() }],
    getBalances: async () => ({ totalDrops: await balance() }),
    requestWithdrawal: async (input): Promise<CustodyTransfer> => {
      const existing = await alreadySent(input.idempotencyKey);
      if (existing) return { id: existing, status: 'submitted', ledgerHash: existing, ledgerIndex: null };
      const payment: Payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: input.destination,
        Amount: input.amountDrops.toString(),
        LastLedgerSequence: input.lastLedgerSequence,
        Memos: [{ Memo: { MemoType: MEMO_TYPE, MemoData: convertStringToHex(input.idempotencyKey) } }],
        ...(input.destinationTag === null ? {} : { DestinationTag: input.destinationTag }),
      };
      const prepared = await client.autofill(payment);
      prepared.LastLedgerSequence = input.lastLedgerSequence;
      const signed = wallet.sign(prepared);
      const res = await client.submit(signed.tx_blob);
      const code = res.result.engine_result;
      // tem/tef: never applied, safe to fail. ter/tes/tec: may still validate, so wait for the ledger.
      if (/^te[mf]/.test(code)) return { id: signed.hash, status: 'failed', ledgerHash: null, ledgerIndex: null };
      return { id: signed.hash, status: 'submitted', ledgerHash: signed.hash, ledgerIndex: null };
    },
    getTransfer: async (id) => ({ id, status: 'submitted', ledgerHash: id, ledgerIndex: null }),
  };
};
