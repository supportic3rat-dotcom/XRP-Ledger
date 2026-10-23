import { fnSchemas } from '@xrp/schemas';
import { customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Collateral top-up: XRP is reserved at once and sent to the lending provider. It counts as collateral
 * (and lowers LTV) only when the provider confirms the lock by webhook.
 */
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
    await ctx.rpc('transition_tx', { p_tx: tx.id, p_to: 'sent', p_actor: 'System', p_note: 'Sent to [Lending provider]' });
    return { transaction: tx };
  },
});

if (import.meta.main) serve(handler);
