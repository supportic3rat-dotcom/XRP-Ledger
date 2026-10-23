import { fnSchemas } from '@xrp/schemas';
import type { TxRow } from '../_shared/customer.ts';
import { type Ctx, defineFunction, serve } from '../_shared/handler.ts';
import { firmQuote } from '../_shared/quotes.ts';

type Decision = { status: 'approved' | 'rejected' | 'pending'; approvals?: number };

/**
 * Approve or reject. Separation of duties and role rules run in SQL as the staff member (their JWT), so the
 * console can't bypass them. Once fully approved, the next provider step starts here; withdrawals are picked
 * up by the XRPL worker.
 */
export const handler = defineFunction({
  name: 'approval-decide',
  schema: fnSchemas['approval-decide'],
  access: { kind: 'staff', roles: ['operations', 'compliance'] },
  run: async (ctx) => {
    const { approvalId, decision, reason, note } = ctx.input;
    const result = await ctx.rpc<Decision>(
      'approval_decide',
      { p_approval: approvalId, p_decision: decision, p_reason: reason ?? null, p_note: note ?? null },
      'user',
    );
    if (result.status === 'approved') await startProviderStep(ctx, approvalId);
    return result;
  },
});

const startProviderStep = async (ctx: Ctx<unknown>, approvalId: string): Promise<void> => {
  const { data } = await ctx.db.from('approvals').select('transactions(*)').eq('id', approvalId).single();
  const tx = (data as { transactions: TxRow } | null)?.transactions;
  if (!tx || tx.amount_drops === null || tx.kind === 'deposit') return;
  const amountDrops = BigInt(String(tx.amount_drops));
  const remember = (fields: Record<string, string>) => ctx.db.from('transactions').update({ meta: { ...tx.meta, ...fields } }).eq('id', tx.id);
  switch (tx.kind) {
    case 'exchange':
      await firmQuote(ctx, tx.id, amountDrops, tx.asset, tx.counter_asset);
      return;
    case 'yield_allocate': {
      const r = await ctx.providers.yield.allocate({ idempotencyKey: tx.id, amountDrops, asset: tx.asset });
      await remember({ provider_request_id: r.requestId });
      return;
    }
    case 'yield_redeem': {
      const r = await ctx.providers.yield.redeem({ idempotencyKey: tx.id, amountDrops, asset: tx.asset });
      await remember({ provider_request_id: r.requestId });
      return;
    }
    case 'loan': {
      const principal = BigInt(String(tx.amount_cents ?? 0));
      const r = await ctx.providers.lending.apply({ idempotencyKey: tx.id, collateralDrops: amountDrops, principalCents: principal, asset: tx.asset });
      await remember({ provider_application_id: r.applicationId });
      return;
    }
  }
};

if (import.meta.main) serve(handler);
