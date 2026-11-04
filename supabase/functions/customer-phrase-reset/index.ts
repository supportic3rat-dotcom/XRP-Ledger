import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Compliance removes the security phrase for a customer who forgot it (all in SQL). */
export const handler = defineFunction({
  name: 'customer-phrase-reset',
  schema: fnSchemas['customer-phrase-reset'],
  access: { kind: 'staff', roles: ['compliance'] },
  run: async (ctx) => {
    await ctx.rpc('customer_phrase_reset', { p_customer: ctx.input.customerId }, 'user');
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
