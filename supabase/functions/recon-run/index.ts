import { fnSchemas } from '@xrp/schemas';
import { formatXrp, formatXrpPrecise } from '@xrp/ledger';
import { providerNames } from '@xrp/providers';
import { type Ctx, defineFunction, serve } from '../_shared/handler.ts';

type Inputs = {
  omnibus_drops: string;
  customer_liabilities_drops: string;
  suspense_drops: string;
  validated_ledger: number;
  chain: Record<string, string>;
  wallets: { id: string; tier: 'hot' | 'warm' | 'cold'; address: string }[];
  suspense_deposits: { id: string; ref: string; amount_drops: string }[];
  delayed: { id: string; ref: string; kind: string; amount_drops: string; minutes: number }[];
  unbooked_fees: { count: number; drops: string } | null;
};

type Exception = { kind: 'unbooked_fee' | 'deposit_no_tag' | 'provider_delay' | 'mismatch'; title: string; note: string; transaction_id?: string; amount_drops?: string };

const xrp = (drops: bigint) => `${formatXrp(drops)} XRP`;

/**
 * Three-way reconciliation: internal ledger vs custody provider vs XRP Ledger. Daily from the upkeep function (about midnight US Eastern)
 * and on demand from the console. Differences become exceptions; nothing is corrected automatically.
 *
 * The ledger keeps one omnibus account. Warm and cold balances only move by provider-run sweeps, so their
 * internal figure is the provider's; the hot wallet carries the remainder, which is where deposits,
 * withdrawals and fees land, and where differences show.
 */
export const handler = defineFunction({
  name: 'recon-run',
  schema: fnSchemas['recon-run'],
  access: { kind: 'staff_or_cron', roles: ['operations', 'compliance'] },
  run: (ctx) => reconcile(ctx),
});

/** One reconciliation run, recorded with its exceptions. Also run daily by the upkeep function. */
export const reconcile = async (ctx: Ctx<unknown>) => {
  const inputs = await ctx.rpc<Inputs>('recon_inputs', {});
  const providerWallets = await ctx.providers.custody.listWallets();
  const providerByTier = new Map(providerWallets.map((w) => [w.tier, w.balanceDrops]));

  const omnibus = BigInt(inputs.omnibus_drops);
  const nonHot = inputs.wallets.filter((w) => w.tier !== 'hot').reduce((sum, w) => sum + (providerByTier.get(w.tier) ?? 0n), 0n);
  const result: Record<string, { internal: string; provider: string; chain: string }> = {};
  for (const w of inputs.wallets) {
    const provider = providerByTier.get(w.tier) ?? 0n;
    const internal = w.tier === 'hot' ? omnibus - nonHot : provider;
    result[w.id] = { internal: internal.toString(), provider: provider.toString(), chain: inputs.chain[w.address] ?? '0' };
  }
  const exceptions = findExceptions(inputs, result);
  const run = await ctx.rpc<{ id: string; ref: string }>(
    'recon_record',
    {
      p_validated_ledger: inputs.validated_ledger,
      p_result: {
        ...result,
        liabilities: { customers: inputs.customer_liabilities_drops, suspense: inputs.suspense_drops },
      },
      p_exceptions: exceptions,
      p_actor: actorName(ctx),
    },
    'service',
  );
  return { run: run.ref, exceptions: exceptions.length };
};

const actorName = (ctx: Ctx<unknown>): string => (ctx.claims ? (ctx.claims.email ?? 'Staff') : 'System');

export const findExceptions = (inputs: Inputs, result: Record<string, { internal: string; provider: string; chain: string }>): Exception[] => {
  const out: Exception[] = [];
  const fees = inputs.unbooked_fees ? BigInt(inputs.unbooked_fees.drops) : 0n;
  if (inputs.unbooked_fees && fees > 0n) {
    out.push({
      kind: 'unbooked_fee',
      title: 'Network fees not booked',
      note: `Hot wallet · ${inputs.unbooked_fees.count} withdrawals · ${formatXrpPrecise(fees)} XRP`,
      amount_drops: fees.toString(),
    });
  }
  for (const [wallet, r] of Object.entries(result)) {
    const internal = BigInt(r.internal);
    const explained = wallet === 'hot' ? fees : 0n;
    if (internal - BigInt(r.chain) !== explained || BigInt(r.provider) !== BigInt(r.chain)) {
      out.push({
        kind: 'mismatch',
        title: 'Balances don’t agree',
        note: `${wallet} · ledger ${xrp(internal)} · provider ${xrp(BigInt(r.provider))} · on ledger ${xrp(BigInt(r.chain))}`,
      });
    }
  }
  for (const d of inputs.suspense_deposits) {
    out.push({ kind: 'deposit_no_tag', title: 'Deposit without destination tag', note: `${d.ref} · ${xrp(BigInt(d.amount_drops))} held in suspense`, transaction_id: d.id });
  }
  for (const d of inputs.delayed) {
    const provider = d.kind === 'loan_collateral' ? providerNames.lending : providerNames.yield;
    out.push({
      kind: 'provider_delay',
      title: 'Provider confirmation delayed',
      note: `${d.ref} · ${xrp(BigInt(d.amount_drops))} pending in ${provider} for ${d.minutes}m`,
      transaction_id: d.id,
    });
  }
  return out;
};

if (import.meta.main) serve(handler);
