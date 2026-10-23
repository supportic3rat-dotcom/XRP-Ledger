import { fnSchemas } from '@xrp/schemas';
import { customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * The customer tells us they've sent a non-XRP asset to the platform address, with the network transaction hash.
 * Nothing is credited here: staff confirm it on the network and approve the credit in the queue.
 */
export const handler = defineFunction({
  name: 'deposit-report',
  schema: fnSchemas['deposit-report'],
  access: { kind: 'customer' },
  idempotent: true,
  run: async (ctx) => {
    const screening = ctx.input.from ? await ctx.providers.screening.screenAddress(ctx.input.from) : null;
    const tx = await ctx.rpc<TxRow>('report_deposit', {
      p_customer: customerId(ctx),
      p_asset: ctx.input.asset,
      p_amount: ctx.input.amountUnits,
      p_tx_hash: ctx.input.txHash,
      p_from: ctx.input.from ?? null,
      p_idempotency_key: ctx.idempotencyKey,
    });
    if (screening) {
      const { data } = await ctx.db.from('approvals').select('checks').eq('transaction_id', tx.id).single();
      const checks = ((data as { checks: unknown[] } | null)?.checks ?? []).concat([
        [screening.hold ? 'Source flagged by screening' : 'Source screened', `[Screening provider] · ${screening.risk} risk`, screening.hold ? 'bad' : 'ok'],
      ]);
      await ctx.db.from('approvals').update({ checks, requires_compliance: screening.hold }).eq('transaction_id', tx.id);
    }
    return { transaction: tx };
  },
});

if (import.meta.main) serve(handler);
