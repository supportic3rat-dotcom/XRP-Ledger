import { fnSchemas } from '@xrp/schemas';
import { customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Redeem from Flexible yield. The asset returns to available only when the provider confirms. */
export const handler = defineFunction({
  name: 'yield-redeem',
  schema: fnSchemas['yield-redeem'],
  access: { kind: 'customer' },
  idempotent: true,
  run: async (ctx) => ({
    transaction: await ctx.rpc<TxRow>('yield_redeem', {
      p_customer: customerId(ctx),
      p_amount_drops: ctx.input.amountDrops,
      p_idempotency_key: ctx.idempotencyKey,
      p_asset: ctx.input.asset,
    }),
  }),
});

if (import.meta.main) serve(handler);
