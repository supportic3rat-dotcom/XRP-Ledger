import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Compliance approves or declines a signing-policy change; an approved change applies after 24 hours. */
export const handler = defineFunction({
  name: 'policy-decide',
  schema: fnSchemas['policy-decide'],
  access: { kind: 'staff', roles: ['compliance'] },
  run: async (ctx) => {
    await ctx.rpc('policy_decide', { p_change: ctx.input.policyChangeId, p_decision: ctx.input.decision }, 'user');
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
