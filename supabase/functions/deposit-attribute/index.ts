import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

/**
 * Records who claims an unattributed deposit (from a support ticket) and opens an approval. The credit
 * happens only when a second person approves it in the queue (approval_decide → attribute_deposit).
 */
export const handler = defineFunction({
  name: 'deposit-attribute',
  schema: fnSchemas['deposit-attribute'],
  access: { kind: 'staff', roles: ['operations', 'compliance'] },
  run: async (ctx) => {
    const { data } = await ctx.db.from('transactions').select('id, meta, status, customer_id').eq('id', ctx.input.transactionId).single();
    const tx = data as { id: string; meta: Record<string, unknown>; status: string; customer_id: string | null } | null;
    if (!tx || tx.status !== 'no_tag' || tx.customer_id) throw new HttpError(400, 'This deposit isn’t waiting in suspense.', 'rejected');
    await ctx.db.from('transactions').update({ meta: { ...tx.meta, claimed_by: ctx.input.customerId } }).eq('id', tx.id);
    const { error } = await ctx.db.from('approvals').upsert({ transaction_id: tx.id, required: 1, requested_by: ctx.userId }, { onConflict: 'transaction_id', ignoreDuplicates: true });
    if (error) throw error;
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
