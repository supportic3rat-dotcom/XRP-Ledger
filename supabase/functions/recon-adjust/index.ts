import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Books an unbooked network fee as a balanced adjustment journal (Operations, with a reason). */
export const handler = defineFunction({
  name: 'recon-adjust',
  schema: fnSchemas['recon-adjust'],
  access: { kind: 'staff', roles: ['operations'] },
  run: async (ctx) => ({
    entryId: await ctx.rpc<string>('recon_adjust', { p_exception: ctx.input.exceptionId, p_reason: ctx.input.reason }, 'user'),
  }),
});

if (import.meta.main) serve(handler);
