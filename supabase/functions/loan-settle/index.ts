import { fnSchemas } from '@xrp/schemas';
import type { TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Staff pay out an approved loan, or confirm a customer's bank repayment arrived (bank reference required). */
export const handler = defineFunction({
  name: 'loan-settle',
  schema: fnSchemas['loan-settle'],
  access: { kind: 'staff', roles: ['operations', 'compliance'] },
  run: async (ctx) => ({
    transaction: await ctx.rpc<TxRow>('loan_settle', { p_tx: ctx.input.transactionId, p_reference: ctx.input.reference }, 'user'),
  }),
});

if (import.meta.main) serve(handler);
