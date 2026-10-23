import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

export const handler = defineFunction({
  name: 'allowlist-remove',
  schema: fnSchemas['allowlist-remove'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    await ctx.rpc('allowlist_remove', { p_customer: customerId(ctx), p_id: ctx.input.id });
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
