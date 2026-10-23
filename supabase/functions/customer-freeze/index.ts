import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Freeze or unfreeze (Compliance only, checked again in SQL). Every money function refuses a frozen customer. */
export const handler = defineFunction({
  name: 'customer-freeze',
  schema: fnSchemas['customer-freeze'],
  access: { kind: 'staff', roles: ['compliance'] },
  run: async (ctx) => {
    await ctx.rpc('customer_freeze', { p_customer: ctx.input.customerId, p_frozen: ctx.input.frozen }, 'user');
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
