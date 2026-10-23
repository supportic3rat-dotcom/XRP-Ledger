import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Chart series from the market data provider. Public: prices aren't personal data. */
export const handler = defineFunction({
  name: 'price-history',
  schema: fnSchemas['price-history'],
  access: { kind: 'public' },
  run: async (ctx) => ({ points: await ctx.providers.prices.getHistory(ctx.input.asset, ctx.input.period) }),
});

if (import.meta.main) serve(handler);
