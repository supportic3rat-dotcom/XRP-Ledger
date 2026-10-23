import { fnSchemas } from '@xrp/schemas';
import { customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Records a repayment request. It counts against the loan only when the lending provider applies it. */
export const handler = defineFunction({
  name: 'loan-repay',
  schema: fnSchemas['loan-repay'],
  access: { kind: 'customer' },
  idempotent: true,
  run: async (ctx) => ({
    transaction: await ctx.rpc<TxRow>('loan_repay', {
      p_customer: customerId(ctx),
      p_loan: ctx.input.loanId,
      p_amount_cents: ctx.input.amountCents,
      p_via: ctx.input.via,
      p_idempotency_key: ctx.idempotencyKey,
    }),
  }),
});

if (import.meta.main) serve(handler);
