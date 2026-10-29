import { fnSchemas } from '@xrp/schemas';
import type { TxRow } from '../_shared/customer.ts';
import { type Ctx, defineFunction, serve } from '../_shared/handler.ts';
import { firmQuote } from '../_shared/quotes.ts';

type Decision = { status: 'approved' | 'rejected' | 'pending'; approvals?: number };

/**
 * Approve or reject. Separation of duties and role rules run in SQL as the staff member (their JWT), so the
 * console can't bypass them. An approved exchange gets its firm quote here; an approved loan locks its collateral
 * in SQL, and staff then pay it out.
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
    if (result.status === 'approved') await startNextStep(ctx, approvalId);
    return result;
  },
});

const startNextStep = async (ctx: Ctx<unknown>, approvalId: string): Promise<void> => {
  const { data } = await ctx.db.from('approvals').select('transactions(*)').eq('id', approvalId).single();
  const tx = (data as { transactions: TxRow } | null)?.transactions;
  if (tx?.kind === 'exchange' && tx.amount_drops !== null) await firmQuote(ctx, tx.id, BigInt(String(tx.amount_drops)), tx.asset, tx.counter_asset);
};

if (import.meta.main) serve(handler);
