import { fnSchemas } from '@xrp/schemas';
import { currentPriceMicro, customerId, type TxRow } from '../_shared/customer.ts';
import { HttpError } from '../_shared/http.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Repay a loan. By bank: it counts once staff confirm the transfer arrived. By selling collateral: the platform sells
 * it at once at the live price and applies it.
 */
export const handler = defineFunction({
  name: 'loan-repay',
  schema: fnSchemas['loan-repay'],
  access: { kind: 'customer' },
  idempotent: true,
  run: async (ctx) => {
    let price: bigint | null = null;
    if (ctx.input.via === 'sell') {
      const { data } = await ctx.db.from('loans').select('collateral_asset').match({ id: ctx.input.loanId, customer_id: customerId(ctx) }).maybeSingle();
      if (!data) throw new HttpError(404, 'Loan not found', 'not_found');
      price = await currentPriceMicro(ctx, (data as { collateral_asset: string }).collateral_asset);
    }
    return {
      transaction: await ctx.rpc<TxRow>('loan_repay', {
        p_customer: customerId(ctx),
        p_loan: ctx.input.loanId,
        p_amount_cents: ctx.input.amountCents,
        p_via: ctx.input.via,
        p_idempotency_key: ctx.idempotencyKey,
        p_price_micro: price?.toString() ?? null,
      }),
    };
  },
});

if (import.meta.main) serve(handler);
