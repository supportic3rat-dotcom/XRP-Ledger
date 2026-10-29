import { encode, encodeForSigning } from 'ripple-binary-codec';
import { sign } from 'ripple-keypairs';

/**
 * Talks to the public XRP Ledger directly (JSON-RPC over HTTPS) for wallets the customer controls: balances, and
 * payments signed on this phone. The custodial account never uses this; its money moves through the platform.
 */
export type Nodes = readonly string[];
export const MAINNET: Nodes = ['https://xrplcluster.com/', 'https://s2.ripple.com:51234/'];
export const TESTNET: Nodes = ['https://s.altnet.rippletest.net:51234/', 'https://testnet.xrpl-labs.com/'];
export const EXPLORER = 'https://livenet.xrpl.org/transactions/';

type Result = Record<string, unknown> & { status?: string; error?: string; error_message?: string };

/** One JSON-RPC call, trying each node in turn. Ledger errors (actNotFound, …) come back as results, not throws. */
export const rpc = async (nodes: Nodes, method: string, params: Record<string, unknown> = {}): Promise<Result> => {
  let last: unknown = null;
  for (const node of nodes) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, params: [params] }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return ((await res.json()) as { result: Result }).result;
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`The XRP Ledger can’t be reached right now. Check your connection and try again.`);
};

export type AccountState = {
  exists: boolean;
  balanceDrops: bigint;
  /** What can be sent: balance less the reserve the ledger keeps locked. */
  spendableDrops: bigint;
  reserveDrops: bigint;
  sequence: number;
};

const xrpToDrops = (xrp: number): bigint => BigInt(Math.round(xrp * 1_000_000));

/** Balance, reserve and next sequence for an address. An unfunded address simply doesn't exist yet. */
export const accountState = async (address: string, nodes: Nodes = MAINNET): Promise<AccountState> => {
  const [info, server] = await Promise.all([
    rpc(nodes, 'account_info', { account: address, ledger_index: 'validated' }),
    rpc(nodes, 'server_info'),
  ]);
  const ledger = ((server.info as Record<string, unknown> | undefined)?.validated_ledger ?? {}) as { reserve_base_xrp?: number; reserve_inc_xrp?: number };
  const base = xrpToDrops(ledger.reserve_base_xrp ?? 1);
  const inc = xrpToDrops(ledger.reserve_inc_xrp ?? 0.2);
  if (info.error === 'actNotFound') return { exists: false, balanceDrops: 0n, spendableDrops: 0n, reserveDrops: base, sequence: 0 };
  const data = info.account_data as { Balance?: string; Sequence?: number; OwnerCount?: number } | undefined;
  if (!data?.Balance) throw new Error(info.error_message ?? 'Couldn’t read this wallet from the XRP Ledger.');
  const balance = BigInt(data.Balance);
  const reserve = base + inc * BigInt(data.OwnerCount ?? 0);
  return { exists: true, balanceDrops: balance, spendableDrops: balance > reserve ? balance - reserve : 0n, reserveDrops: reserve, sequence: data.Sequence ?? 0 };
};

export type PaymentRequest = { from: string; to: string; amountDrops: bigint; destinationTag?: number | null };
export type PreparedPayment = { tx: Record<string, unknown>; feeDrops: bigint; lastLedger: number };

/** A Payment with sequence, fee (the open-ledger fee, at least 12 drops) and a ~1 minute expiry filled in. */
export const preparePayment = async (req: PaymentRequest, nodes: Nodes = MAINNET): Promise<PreparedPayment> => {
  const [account, fee, current] = await Promise.all([accountState(req.from, nodes), rpc(nodes, 'fee'), rpc(nodes, 'ledger_current')]);
  if (!account.exists) throw new Error('This wallet isn’t activated on the XRP Ledger yet. Send it at least the reserve first.');
  const open = BigInt(String((fee.drops as Record<string, string> | undefined)?.open_ledger_fee ?? '12'));
  const feeDrops = open < 12n ? 12n : open > 2000n ? 2000n : open;
  if (req.amountDrops + feeDrops > account.spendableDrops) {
    throw new Error(`That’s more than this wallet can send. Up to ${Number(account.spendableDrops - feeDrops) / 1_000_000} XRP is available after the network fee and reserve.`);
  }
  const lastLedger = Number(current.ledger_current_index ?? 0) + 20;
  const tx: Record<string, unknown> = {
    TransactionType: 'Payment',
    Account: req.from,
    Destination: req.to,
    Amount: req.amountDrops.toString(),
    Fee: feeDrops.toString(),
    Sequence: account.sequence,
    LastLedgerSequence: lastLedger,
    Flags: 0,
    ...(req.destinationTag !== null && req.destinationTag !== undefined ? { DestinationTag: req.destinationTag } : {}),
  };
  return { tx, feeDrops, lastLedger };
};

/** Signs on this device. The private key is used here and nowhere else. */
export const signPayment = (tx: Record<string, unknown>, keys: { publicKey: string; privateKey: string }): string => {
  const unsigned = { ...tx, SigningPubKey: keys.publicKey };
  return encode({ ...unsigned, TxnSignature: sign(encodeForSigning(unsigned), keys.privateKey) });
};

const READABLE: Record<string, string> = {
  tecUNFUNDED_PAYMENT: 'This wallet doesn’t have enough XRP for that.',
  tecNO_DST_INSUF_XRP: 'The destination isn’t activated yet, and this is less than the amount needed to activate it.',
  tecDST_TAG_NEEDED: 'The destination needs a destination tag (memo). Ask the recipient for it.',
  tecNO_PERMISSION: 'The destination doesn’t accept this payment.',
  tefPAST_SEQ: 'Another transaction from this wallet went first. Try again.',
  telINSUF_FEE_P: 'The network is busy. Try again in a moment.',
};

export type PaymentResult = { hash: string; result: string; ledgerIndex: number | null };

/** Submits and waits for the payment to be validated (or to expire). Only a validated tesSUCCESS is a success. */
export const submitAndWait = async (blob: string, lastLedger: number, nodes: Nodes = MAINNET, pollMs = 2000): Promise<PaymentResult> => {
  const sent = await rpc(nodes, 'submit', { tx_blob: blob });
  const engine = String(sent.engine_result ?? sent.error ?? 'unknown');
  const hash = String((sent.tx_json as Record<string, unknown> | undefined)?.hash ?? '');
  if (!hash || !/^(tes|ter|tec)/.test(engine) || engine === 'terNO_ACCOUNT') {
    throw new Error(READABLE[engine] ?? `The XRP Ledger refused the payment (${engine}).`);
  }
  for (;;) {
    await new Promise((r) => setTimeout(r, pollMs));
    const t = await rpc(nodes, 'tx', { transaction: hash });
    if (t.validated === true) {
      const result = String((t.meta as Record<string, unknown> | undefined)?.TransactionResult ?? 'unknown');
      if (result !== 'tesSUCCESS') throw new Error(READABLE[result] ?? `The payment failed on the ledger (${result}).`);
      return { hash, result, ledgerIndex: Number(t.ledger_index ?? 0) || null };
    }
    const now = await rpc(nodes, 'ledger', { ledger_index: 'validated' });
    if (Number(now.ledger_index ?? 0) > lastLedger) throw new Error('The payment expired before it was confirmed. Nothing was sent; try again.');
  }
};

/** The XRP address in a scanned QR code or pasted text: a bare address, or an xrpl:/ripple: link (with ?dt= tag). */
export const parseAddressInput = (text: string): { address: string; tag: number | null } | null => {
  const m = text.trim().match(/(?:^|[:/?=\s])?(r[1-9A-HJ-NP-Za-km-z]{24,34})(?:\?(?:.*&)?(?:dt|tag)=(\d+))?/);
  if (!m?.[1]) return null;
  return { address: m[1], tag: m[2] ? Number(m[2]) : null };
};
