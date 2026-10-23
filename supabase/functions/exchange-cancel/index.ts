import { fnSchemas } from '@xrp/schemas';
import { customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

export const handler = defineFunction({
  name: 'exchange-cancel',
  schema: fnSchemas['exchange-cancel'],
  access: { kind: 'customer' },
  run: async (ctx) => ({
    transaction: await ctx.rpc<TxRow>('cancel_exchange', { p_customer: customerId(ctx), p_tx: ctx.input.transactionId }),
  }),
});

if (import.meta.main) serve(handler);
