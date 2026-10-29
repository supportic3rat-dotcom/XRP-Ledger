/**
 * Read-only balances for wallets customers link (watch-only), on every network the platform supports. Public data
 * only, from free public endpoints; nothing here can move funds. Amounts come back in the platform's base units for
 * each asset (`assets.decimals`), truncated from the chain's own precision.
 */
export type ChainBalances = Record<string, bigint>;

/** Platform precision per asset (matches `assets.decimals`). */
export const PLATFORM_DECIMALS: Record<string, number> = {
  XRP: 6, BTC: 8, ETH: 8, USDT: 6, USDC: 6, SOL: 8, BNB: 8, TRX: 6, DOGE: 8, ADA: 6, XLM: 7, HBAR: 8, LTC: 8, CRO: 8, POL: 8, ATOM: 6, DASH: 8, FLR: 8,
};

const TIMEOUT = 10_000;

const scale = (raw: bigint, fromDecimals: number, asset: string): bigint => {
  const to = PLATFORM_DECIMALS[asset] ?? fromDecimals;
  return to >= fromDecimals ? raw * 10n ** BigInt(to - fromDecimals) : raw / 10n ** BigInt(fromDecimals - to);
};

/** "123.4567890" → base units at `decimals`. */
const parseDecimal = (text: string, decimals: number): bigint => {
  const [whole = '0', frac = ''] = text.split('.');
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0');
};

const getJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  if (res.status === 404) throw Object.assign(new Error('not found'), { notFound: true });
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return (await res.json()) as T;
};

const rpcCall = async <T>(url: string, method: string, params: unknown[]): Promise<T> => {
  const body = await getJson<{ result?: T; error?: { message: string } }>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (body.error) throw new Error(body.error.message);
  return body.result as T;
};

// ───────── EVM chains ─────────
const EVM: Record<string, { rpc: string; native: string; tokens?: Record<string, { contract: string; decimals: number }> }> = {
  ethereum: {
    rpc: 'https://ethereum-rpc.publicnode.com',
    native: 'ETH',
    tokens: {
      USDT: { contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      USDC: { contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      POL: { contract: '0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6', decimals: 18 },
    },
  },
  bnb: { rpc: 'https://bsc-rpc.publicnode.com', native: 'BNB' },
  polygon: { rpc: 'https://polygon-bor-rpc.publicnode.com', native: 'POL' },
  cronos: { rpc: 'https://evm.cronos.org', native: 'CRO' },
  flare: { rpc: 'https://flare-api.flare.network/ext/C/rpc', native: 'FLR' },
};

const evmBalances = async (network: string, address: string): Promise<ChainBalances> => {
  const chain = EVM[network]!;
  const out: ChainBalances = { [chain.native]: scale(BigInt(await rpcCall<string>(chain.rpc, 'eth_getBalance', [address, 'latest'])), 18, chain.native) };
  for (const [asset, t] of Object.entries(chain.tokens ?? {})) {
    const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`;
    const raw = await rpcCall<string>(chain.rpc, 'eth_call', [{ to: t.contract, data }, 'latest']);
    out[asset] = scale(BigInt(raw === '0x' ? '0x0' : raw), t.decimals, asset);
  }
  return out;
};

// ───────── UTXO chains ─────────
const esplora = async (base: string, address: string, asset: string): Promise<ChainBalances> => {
  const r = await getJson<{ chain_stats: { funded_txo_sum: number; spent_txo_sum: number } }>(`${base}/address/${address}`);
  return { [asset]: BigInt(r.chain_stats.funded_txo_sum - r.chain_stats.spent_txo_sum) };
};

const blockcypher = async (coin: string, address: string, asset: string): Promise<ChainBalances> => {
  const r = await getJson<{ final_balance: number }>(`https://api.blockcypher.com/v1/${coin}/main/addrs/${address}/balance`);
  return { [asset]: BigInt(r.final_balance) };
};

/** The first source that answers (public endpoints come and go). */
const firstOf = async (sources: (() => Promise<ChainBalances>)[]): Promise<ChainBalances> => {
  let last: unknown = null;
  for (const source of sources) {
    try {
      return await source();
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('No balance source answered');
};

// ───────── Everything else ─────────
const readers: Record<string, (address: string) => Promise<ChainBalances>> = {
  xrp: async (address) => {
    const r = await getJson<{ result: { error?: string; account_data?: { Balance: string } } }>('https://xrplcluster.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'account_info', params: [{ account: address, ledger_index: 'validated' }] }),
    });
    if (r.result.error === 'actNotFound') return { XRP: 0n };
    if (!r.result.account_data) throw new Error(r.result.error ?? 'XRP Ledger error');
    return { XRP: BigInt(r.result.account_data.Balance) };
  },
  bitcoin: (a) => firstOf([() => esplora('https://blockstream.info/api', a, 'BTC'), () => esplora('https://mempool.space/api', a, 'BTC'), () => blockcypher('btc', a, 'BTC')]),
  litecoin: (a) => firstOf([() => blockcypher('ltc', a, 'LTC'), () => esplora('https://litecoinspace.org/api', a, 'LTC')]),
  dogecoin: (a) => blockcypher('doge', a, 'DOGE'),
  dash: (a) => blockcypher('dash', a, 'DASH'),
  ethereum: (a) => evmBalances('ethereum', a),
  bnb: (a) => evmBalances('bnb', a),
  polygon: (a) => evmBalances('polygon', a),
  cronos: (a) => evmBalances('cronos', a),
  flare: (a) => evmBalances('flare', a),
  tron: async (address) => {
    const r = await getJson<{ data: { balance?: number; trc20?: Record<string, string>[] }[] }>(`https://api.trongrid.io/v1/accounts/${address}`);
    const acct = r.data[0];
    const usdt = acct?.trc20?.find((t) => 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' in t)?.['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'] ?? '0';
    return { TRX: BigInt(acct?.balance ?? 0), USDT: BigInt(usdt) };
  },
  solana: async (address) => {
    const url = 'https://api.mainnet-beta.solana.com';
    const lamports = await rpcCall<{ value: number }>(url, 'getBalance', [address]);
    const tokens = await rpcCall<{ value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[] }>(url, 'getTokenAccountsByOwner', [
      address,
      { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
      { encoding: 'jsonParsed' },
    ]);
    const usdc = tokens.value.reduce((s, t) => s + BigInt(t.account.data.parsed.info.tokenAmount.amount), 0n);
    return { SOL: scale(BigInt(lamports.value), 9, 'SOL'), USDC: usdc };
  },
  cardano: async (address) => {
    const r = await getJson<{ balance?: string }[]>('https://api.koios.rest/api/v1/address_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ _addresses: [address] }),
    });
    return { ADA: BigInt(r[0]?.balance ?? '0') };
  },
  stellar: async (address) => {
    try {
      const r = await getJson<{ balances: { asset_type: string; balance: string }[] }>(`https://horizon.stellar.org/accounts/${address}`);
      return { XLM: parseDecimal(r.balances.find((b) => b.asset_type === 'native')?.balance ?? '0', 7) };
    } catch (e) {
      if ((e as { notFound?: boolean }).notFound) return { XLM: 0n }; // not activated yet
      throw e;
    }
  },
  hedera: async (accountId) => {
    const r = await getJson<{ balance: { balance: number } }>(`https://mainnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`);
    return { HBAR: BigInt(r.balance.balance) };
  },
  cosmos: async (address) => {
    const r = await getJson<{ balances: { denom: string; amount: string }[] }>(`https://cosmos-rest.publicnode.com/cosmos/bank/v1beta1/balances/${address}`);
    return { ATOM: BigInt(r.balances.find((b) => b.denom === 'uatom')?.amount ?? '0') };
  },
};

export const SUPPORTED_NETWORKS = Object.keys(readers);

/** Every supported asset's balance at `address` on `network`. */
export const chainBalances = async (network: string, address: string): Promise<ChainBalances> => {
  const read = readers[network];
  if (!read) throw new Error(`Unsupported network ${network}`);
  return read(address);
};
