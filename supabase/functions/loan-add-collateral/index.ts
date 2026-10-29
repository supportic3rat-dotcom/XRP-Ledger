import { fnSchemas } from '@xrp/schemas';
import { customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Collateral top-up: locked at once on the platform, lowering the loan's LTV. */
export const handler = defineFunction({
  name: 'loan-add-collateral',
  schema: fnSchemas['loan-add-collateral'],
  access: { kind: 'customer' },
  idempotent: true,
  run: async (ctx) => {
    const tx = await ctx.rpc<TxRow>('loan_add_collateral', {
      p_customer: customerId(ctx),
      p_loan: ctx.input.loanId,
      p_amount_drops: ctx.input.amountDrops,
      p_idempotency_key: ctx.idempotencyKey,
    });
    return { transaction: tx };
  },
});

if (import.meta.main) serve(handler);
