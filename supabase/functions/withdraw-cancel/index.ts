import { fnSchemas } from '@xrp/schemas';
import { customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Cancels a withdrawal still in review; the hold is released by the compensating journal. */
export const handler = defineFunction({
  name: 'withdraw-cancel',
  schema: fnSchemas['withdraw-cancel'],
  access: { kind: 'customer' },
  run: async (ctx) => ({
    transaction: await ctx.rpc<TxRow>('cancel_withdrawal', { p_customer: customerId(ctx), p_tx: ctx.input.transactionId }),
  }),
});

if (import.meta.main) serve(handler);
