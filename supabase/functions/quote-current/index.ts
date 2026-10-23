import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/** The live firm quote for one of the caller's exchange requests, or null. */
export const handler = defineFunction({
  name: 'quote-current',
  schema: fnSchemas['quote-current'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const { data: tx } = await ctx.db.from('transactions').select('id').match({ id: ctx.input.transactionId, customer_id: customerId(ctx) }).maybeSingle();
    if (!tx) return null;
    const { data } = await ctx.db
      .from('quotes')
      .select('id, price_micro, fee_cents, receive_cents, receive_units, expires_at')
      .eq('transaction_id', ctx.input.transactionId)
      .is('accepted_at', null)
      .gt('expires_at', ctx.now().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  },
});

if (import.meta.main) serve(handler);
