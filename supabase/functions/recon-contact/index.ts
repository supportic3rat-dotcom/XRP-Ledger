import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

export const handler = defineFunction({
  name: 'recon-contact',
  schema: fnSchemas['recon-contact'],
  access: { kind: 'staff', roles: ['operations', 'compliance'] },
  run: async (ctx) => {
    await ctx.rpc('recon_contact', { p_exception: ctx.input.exceptionId }, 'user');
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
