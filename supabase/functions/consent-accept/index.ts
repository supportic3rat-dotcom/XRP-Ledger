import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

type ConsentRow = { id: string; document: string; version: string; accepted_at: string; surface: string };

/** Records acceptance of the current version of a legal document. Accepting twice returns the first record. */
export const handler = defineFunction({
  name: 'consent-accept',
  schema: fnSchemas['consent-accept'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const c = await ctx.rpc<ConsentRow>('consent_accept', {
      p_customer: customerId(ctx),
      p_document: ctx.input.document,
      p_version: ctx.input.version,
      p_surface: ctx.req.headers.get('x-surface') ?? 'Mobile app',
    });
    return { document: c.document, version: c.version, acceptedAt: c.accepted_at, surface: c.surface, consentId: c.id };
  },
});

if (import.meta.main) serve(handler);
