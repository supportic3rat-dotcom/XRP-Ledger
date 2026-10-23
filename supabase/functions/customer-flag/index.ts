import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

export const handler = defineFunction({
  name: 'customer-flag',
  schema: fnSchemas['customer-flag'],
  access: { kind: 'staff', roles: ['operations', 'compliance'] },
  run: async (ctx) => {
    await ctx.rpc('customer_flag', { p_customer: ctx.input.customerId, p_note: ctx.input.note }, 'user');
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
