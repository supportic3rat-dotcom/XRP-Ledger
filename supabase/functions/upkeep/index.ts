import { ASSET_IDS } from '@xrp/ledger';
import { fnSchemas } from '@xrp/schemas';
import { type Ctx, defineFunction, serve } from '../_shared/handler.ts';
import { liveMarketData } from '../_shared/providers.ts';
import { reconcile } from '../recon-run/index.ts';

/**
 * Scheduled upkeep on Supabase (prices, Earn rewards, loan interest and LTV checks, reconciliation), with no server and no pg_cron: the app calls this while it's open, and each job runs
 * only when it's due (public.upkeep_claim stops two callers running the same job). Daily jobs run on the first call
 * after their time, so a quiet night is caught up by the next morning's first visit.
 *
 * Public on purpose: it takes no input, returns nothing private and does nothing that isn't already due.
 */
const MIN = 60;
type Job = { name: string; everySec: number; dailyAtUtcMin?: number; run: (ctx: Ctx<unknown>) => Promise<unknown> };

const job = (name: string) => (ctx: Ctx<unknown>) => ctx.rpc('run_job', { p_job: name });

export const JOBS: Job[] = [
  { name: 'prices', everySec: 5 * MIN, run: (ctx) => recordPrices(ctx) },
  { name: 'quote-expiry', everySec: MIN, run: job('quote-expiry') },
  { name: 'ltv-check', everySec: 5 * MIN, run: job('ltv-check') },
  { name: 'balances-snapshot', everySec: 10 * MIN, run: job('balances-snapshot') },
  { name: 'chain', everySec: 10 * MIN, run: (ctx) => readLedger(ctx) },
  { name: 'yield-accrual', everySec: 60 * MIN, run: job('yield-accrual') },
  { name: 'yield-rewards', everySec: 0, dailyAtUtcMin: 0, run: job('yield-rewards') }, // Earn payouts
  { name: 'loan-interest', everySec: 0, dailyAtUtcMin: 0, run: job('loan-interest') },
  { name: 'recon', everySec: 0, dailyAtUtcMin: 23 * 60, run: (ctx) => reconcile(ctx) }, // 00:00 WAT
  { name: 'audit-verify', everySec: 0, dailyAtUtcMin: 23 * 60 + 30, run: job('audit-verify') },
];

export const handler = defineFunction({
  name: 'upkeep',
  schema: fnSchemas.upkeep,
  access: { kind: 'public' },
  run: async (ctx) => {
    const ran: string[] = [];
    for (const j of JOBS) {
      const due = await ctx.rpc<boolean>('upkeep_claim', { p_job: j.name, p_every: `${j.everySec} seconds`, p_daily_at: j.dailyAtUtcMin ?? null });
      if (!due) continue;
      try {
        await j.run(ctx);
        ran.push(j.name);
      } catch (e) {
        // A failed job waits for its next slot; the others still run.
        console.error(JSON.stringify({ job: j.name, error: e instanceof Error ? e.message : String(e) }));
      }
    }
    return { ran };
  },
});

/** Every coin's price and 24-hour change, in one request (what money actions and loan checks value with). */
const recordPrices = async (ctx: Ctx<unknown>) => {
  const cg = liveMarketData();
  const rows = cg
    ? (await cg.prices(ASSET_IDS)).map((p) => ({ asset: p.asset, usd_micro: p.priceMicro.toString(), change_bps: p.changeBps, source: 'Market data' }))
    : await Promise.all(
        ASSET_IDS.map(async (a) => ({ asset: a, usd_micro: (await ctx.providers.prices.getPrice(a)).priceMicro.toString(), change_bps: 0, source: 'Sample data' })),
      );
  const { error } = await ctx.db.from('prices').insert(rows);
  if (error) throw new Error(error.message);
};

const NODES: Record<string, string[]> = {
  mainnet: ['https://xrplcluster.com/', 'https://s2.ripple.com:51234/'],
  testnet: ['https://s.altnet.rippletest.net:51234/', 'https://testnet.xrpl-labs.com/'],
};

type RpcResult = { status?: string; error?: string; ledger_index?: number; account_data?: { Balance: string } };

const xrpl = async (node: string, method: string, params: Record<string, unknown>): Promise<RpcResult> => {
  const res = await fetch(node, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params: [params] }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`${node} returned ${res.status}`);
  return ((await res.json()) as { result: RpcResult }).result;
};

/**
 * Reads the XRP Ledger over HTTP: the platform wallets' balances (for reconciliation), customers' linked outside
 * wallets, and a heartbeat with the latest validated ledger and how many of the two nodes answered.
 */
const readLedger = async (ctx: Ctx<unknown>) => {
  const nodes = NODES[Deno.env.get('XRPL_NETWORK') === 'testnet' ? 'testnet' : 'mainnet'] ?? [];
  const answers = await Promise.allSettled(nodes.map((n) => xrpl(n, 'ledger', { ledger_index: 'validated' })));
  const live = nodes.filter((_, i) => answers[i]?.status === 'fulfilled');
  const node = live[0];
  if (!node) throw new Error('No XRP Ledger node answered');
  const ledger = Math.max(...answers.map((a) => (a.status === 'fulfilled' ? Number(a.value.ledger_index ?? 0) : 0)));

  const balance = async (address: string): Promise<string> => {
    const r = await xrpl(node, 'account_info', { account: address, ledger_index: 'validated' });
    if (r.error === 'actNotFound') return '0';
    if (!r.account_data) throw new Error(`No balance for ${address}: ${r.error ?? 'unknown error'}`);
    return r.account_data.Balance;
  };
  const at = new Date().toISOString();
  const { data: wallets } = await ctx.db.from('custody_wallets').select('address');
  for (const w of (wallets ?? []) as { address: string }[]) {
    await ctx.db.from('chain_balances').upsert({ address: w.address, balance_drops: await balance(w.address), ledger_index: ledger, at });
  }
  const { data: linked } = await ctx.db.from('external_wallets').select('id, address').is('removed_at', null);
  for (const w of (linked ?? []) as { id: string; address: string }[]) {
    const drops = await balance(w.address).catch(() => null);
    if (drops !== null) await ctx.db.from('external_wallets').update({ balance_drops: drops, balance_at: at }).eq('id', w.id);
  }
  await ctx.db.from('worker_heartbeat').upsert({ worker: 'supabase-upkeep', validated_ledger: ledger, nodes_in_sync: live.length, at });
};

if (import.meta.main) serve(handler);
