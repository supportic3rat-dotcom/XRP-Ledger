import { fnSchemas } from '@xrp/schemas';
import { customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Accepts a live firm quote: XRP moves available → reserved in the same SQL transaction, then the
 * liquidity provider executes. "Sold" and the payout arrive by provider webhook.
 */
export const handler = defineFunction({
  name: 'exchange-accept',
  schema: fnSchemas['exchange-accept'],
  access: { kind: 'customer', aal2: true },
  run: async (ctx) => {
    const tx = await ctx.rpc<TxRow>('accept_quote', { p_customer: customerId(ctx), p_tx: ctx.input.transactionId, p_quote: ctx.input.quoteId });
    const execution = await ctx.providers.liquidity.executeQuote(ctx.input.quoteId);
    await ctx.db
      .from('transactions')
      .update({ meta: { ...tx.meta, execution_id: execution.executionId } })
      .eq('id', tx.id);
    return { transaction: tx };
  },
});

if (import.meta.main) serve(handler);
