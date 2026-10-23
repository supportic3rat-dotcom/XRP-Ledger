import { createCoinGecko, createMockProviders } from '@xrp/providers';
import { xrplChain } from './chain.ts';
import { loadConfig } from './config.ts';
import { type JobName, reconCaller, runDueJobs } from './jobs.ts';
import { scanTo } from './scanner.ts';
import { supabaseStore } from './store.ts';
import { testnetCustody } from './testnetCustody.ts';
import { recordAllPrices, refreshBalances, recordPrice } from './upkeep.ts';
import { confirmSubmitted, submitApproved } from './withdrawals.ts';

const BALANCE_EVERY_LEDGERS = 10;

const log = (msg: string, extra?: unknown) =>
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      msg,
      ...(extra && typeof extra === 'object' ? extra : extra === undefined ? {} : { detail: String(extra) }),
    }),
  );

const main = async () => {
  const cfg = loadConfig();
  const store = supabaseStore(cfg.supabaseUrl, cfg.serviceRoleKey);
  const chain = await xrplChain(cfg.endpoints, log);
  const providers = createMockProviders({ latencyMs: 0 });
  const custody = cfg.testnetHotSeed ? await testnetCustody(cfg.endpoints[0], cfg.testnetHotSeed) : providers.custody;

  const wallets = await store.wallets();
  const omnibus = new Set(wallets.filter((w) => w.tier === 'hot').map((w) => w.address));
  const own = new Set(wallets.map((w) => w.address));
  log('worker started', { network: cfg.network, omnibus: [...omnibus], signer: cfg.testnetHotSeed ? 'testnet' : 'custody provider' });

  // One tick at a time; ledgers that close meanwhile are covered by the next tick's range.
  let latest = await chain.validatedLedger();
  let running = false;
  let ticks = 0;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      while (true) {
        const upTo = latest;
        await scanTo({ chain, store, screening: providers.screening, omnibus, own, log }, upTo);
        await submitApproved({ chain, store, custody, log });
        await confirmSubmitted({ chain, store, custody, log });
        if (ticks++ % BALANCE_EVERY_LEDGERS === 0) await refreshBalances({ chain, store }, wallets, upTo);
        if (latest === upTo) break;
      }
    } catch (e) {
      log('tick failed; retrying on the next ledger', { error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = false;
    }
  };
  chain.onValidatedLedger((i) => {
    latest = Math.max(latest, i);
    void tick();
  });
  void tick();

  const beat = async () => {
    try {
      await store.heartbeat(cfg.workerId, latest, await chain.nodesInSync());
    } catch (e) {
      log('heartbeat failed', { error: String(e) });
    }
  };
  void beat();
  const heartbeat = setInterval(() => void beat(), cfg.heartbeatMs);
  const cg = createCoinGecko({ apiKey: cfg.coingeckoKey ?? undefined, pro: cfg.coingeckoPro });
  const updatePrices = () =>
    (cfg.marketData === 'coingecko' ? recordAllPrices(cg, store) : recordPrice(providers.prices, store)).catch((e) => log('price update failed', { error: String(e) }));
  const prices = setInterval(() => void updatePrices(), cfg.priceMs);
  void updatePrices();

  // Scheduled upkeep (quote expiry, LTV checks, yield estimates, snapshots, daily recon and audit check); no pg_cron.
  const lastRun = new Map<JobName, number>();
  const jobDeps = { store, runRecon: cfg.cronSecret ? reconCaller(cfg.supabaseUrl, cfg.cronSecret) : null, log };
  let jobsRunning = false;
  const runJobs = async () => {
    if (jobsRunning) return;
    jobsRunning = true;
    await runDueJobs(jobDeps, Date.now(), lastRun).finally(() => (jobsRunning = false));
  };
  const jobs = setInterval(() => void runJobs(), 30_000);
  void runJobs();

  const stop = () => {
    log('worker stopping');
    clearInterval(heartbeat);
    clearInterval(prices);
    clearInterval(jobs);
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
};

main().catch((e) => {
  log('worker crashed', { error: e instanceof Error ? e.stack : String(e) });
  process.exit(1);
});
