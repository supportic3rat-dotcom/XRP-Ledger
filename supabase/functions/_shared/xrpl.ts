/** Reads the public XRP Ledger over JSON-RPC (HTTPS): two nodes per network, so one being down doesn't stop us. */
const NODES: Record<string, string[]> = {
  mainnet: ['https://xrplcluster.com/', 'https://s2.ripple.com:51234/'],
  testnet: ['https://s.altnet.rippletest.net:51234/', 'https://testnet.xrpl-labs.com/'],
};

export const ledgerNodes = (): string[] => NODES[Deno.env.get('XRPL_NETWORK') === 'testnet' ? 'testnet' : 'mainnet'] ?? [];

type RpcResult = { status?: string; error?: string; ledger_index?: number; account_data?: { Balance: string } };

export const xrpl = async (node: string, method: string, params: Record<string, unknown>): Promise<RpcResult> => {
  const res = await fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params: [params] }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`${node} returned ${res.status}`);
  return ((await res.json()) as { result: RpcResult }).result;
};

/** An address's validated XRP balance in drops ('0' for an address that isn't activated), trying each node. */
export const xrpBalance = async (address: string): Promise<string> => {
  let last: unknown = null;
  for (const node of ledgerNodes()) {
    try {
      const r = await xrpl(node, 'account_info', { account: address, ledger_index: 'validated' });
      if (r.error === 'actNotFound') return '0';
      if (r.account_data) return r.account_data.Balance;
      last = r.error;
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`Couldn’t read ${address}: ${String(last)}`);
};
