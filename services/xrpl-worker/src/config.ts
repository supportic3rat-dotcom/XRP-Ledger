/** Worker configuration from the environment. The service role key lives only here and in Edge Functions. */
export type Config = {
  supabaseUrl: string;
  serviceRoleKey: string;
  network: 'testnet' | 'mainnet';
  /** Primary (self-hosted or paid) and fallback (public) rippled WebSocket endpoints. */
  endpoints: [string, string];
  workerId: string;
  /** Testnet only: signs withdrawals locally in place of the custody provider. Never set on mainnet. */
  testnetHotSeed: string | null;
  heartbeatMs: number;
  priceMs: number;
  /** `coingecko` (default) records live prices for every asset; `mock` uses the deterministic sample feed. */
  marketData: 'coingecko' | 'mock';
  /** Optional CoinGecko key (demo or pro) for a higher rate limit. */
  coingeckoKey: string | null;
  coingeckoPro: boolean;
  /** Shared secret for calling recon-run; without it the daily reconciliation is skipped. */
  cronSecret: string | null;
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const v = env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const network = env.XRPL_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  const testnetHotSeed = env.TESTNET_HOT_WALLET_SEED ?? null;
  if (network === 'mainnet' && testnetHotSeed)
    throw new Error('TESTNET_HOT_WALLET_SEED must not be set on mainnet: signing happens only at the custody provider.');
  return {
    supabaseUrl: required(env, 'SUPABASE_URL'),
    serviceRoleKey: required(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    network,
    endpoints: [
      env.XRPL_PRIMARY_WS ?? (network === 'testnet' ? 'wss://s.altnet.rippletest.net:51233' : required(env, 'XRPL_PRIMARY_WS')),
      env.XRPL_FALLBACK_WS ?? (network === 'testnet' ? 'wss://testnet.xrpl-labs.com' : 'wss://xrplcluster.com'),
    ],
    workerId: env.WORKER_ID ?? 'xrpl-worker',
    testnetHotSeed,
    heartbeatMs: 30_000,
    priceMs: 60_000,
    marketData: env.MARKET_DATA === 'mock' ? 'mock' : 'coingecko',
    coingeckoKey: env.COINGECKO_API_KEY ?? null,
    coingeckoPro: env.COINGECKO_PRO === '1',
    cronSecret: env.CRON_SECRET ?? null,
  };
};
