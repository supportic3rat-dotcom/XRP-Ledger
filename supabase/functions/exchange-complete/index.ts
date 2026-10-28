import { fnSchemas } from '@xrp/schemas';
import type { TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Staff settle an accepted exchange: a USD sale once they've made the bank transfer (with its reference), or a swap
 * (the bought coin is credited). The customer is notified and it's audited, in SQL.
 */
export const handler = defineFunction({
  name: 'exchange-complete',
  schema: fnSchemas['exchange-complete'],
  access: { kind: 'staff', roles: ['operations', 'compliance'] },
  run: async (ctx) => ({
    transaction: await ctx.rpc<TxRow>('exchange_complete', { p_tx: ctx.input.transactionId, p_reference: ctx.input.reference }, 'user'),
  }),
});

if (import.meta.main) serve(handler);
