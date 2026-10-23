import { fnSchemas } from '@xrp/schemas';
import { customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Allocate to Flexible yield: records consent to the yield terms, moves XRP available → pending yield and
 * opens an Operations approval. The provider allocation is sent once approved (see approval-decide).
 */
export const handler = defineFunction({
  name: 'yield-allocate',
  schema: fnSchemas['yield-allocate'],
  access: { kind: 'customer', aal2: true },
  idempotent: true,
  run: async (ctx) => ({
    transaction: await ctx.rpc<TxRow>('yield_allocate', {
      p_customer: customerId(ctx),
      p_amount_drops: ctx.input.amountDrops,
      p_terms_version: ctx.input.termsVersion,
      p_idempotency_key: ctx.idempotencyKey,
      p_asset: ctx.input.asset,
    }),
  }),
});

if (import.meta.main) serve(handler);
