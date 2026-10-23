import { fnSchemas } from '@xrp/schemas';
import type { TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Non-XRP withdrawals are sent by staff from the platform wallet after approval. This records the outcome:
 * sent (with the network hash; the fee is booked) or failed (the reserved funds return to the customer).
 */
export const handler = defineFunction({
  name: 'withdrawal-complete',
  schema: fnSchemas['withdrawal-complete'],
  access: { kind: 'staff', roles: ['operations', 'compliance'] },
  run: async (ctx) => {
    const input = ctx.input;
    const transaction =
      input.action === 'sent'
        ? await ctx.rpc<TxRow>('withdrawal_mark_sent', { p_tx: input.transactionId, p_hash: input.txHash }, 'user')
        : await ctx.rpc<TxRow>('withdrawal_mark_failed', { p_tx: input.transactionId, p_reason: input.reason }, 'user');
    return { transaction };
  },
});

if (import.meta.main) serve(handler);
