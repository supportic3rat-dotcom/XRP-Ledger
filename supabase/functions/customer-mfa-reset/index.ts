import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Compliance removes two-factor for a customer who lost their authenticator and backup codes (all in SQL). */
export const handler = defineFunction({
  name: 'customer-mfa-reset',
  schema: fnSchemas['customer-mfa-reset'],
  access: { kind: 'staff', roles: ['compliance'] },
  run: async (ctx) => {
    await ctx.rpc('customer_mfa_reset', { p_customer: ctx.input.customerId }, 'user');
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
