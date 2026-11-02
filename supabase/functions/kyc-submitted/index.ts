import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';
import { alertCompliance } from '../_shared/push.ts';

/** Called once every photo is uploaded: checks they all arrived, puts the customer under review and alerts Compliance. */
export const handler = defineFunction({
  name: 'kyc-submitted',
  schema: fnSchemas['kyc-submitted'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const me = customerId(ctx);
    const { reference } = ctx.input;
    const { data: pending } = await ctx.db.from('kyc_pending').select('documents').eq('provider_ref', reference).eq('customer_id', me).maybeSingle();
    if (pending) {
      const { data: stored, error } = await ctx.db.storage.from('kyc').list(`${me}/${reference}`);
      if (error) throw error;
      const names = new Set((stored ?? []).map((f) => f.name));
      const allThere = (pending.documents as string[]).every((path) => names.has(path.split('/').pop() ?? ''));
      if (!allThere) throw new HttpError(400, 'A photo didn’t upload. Check your connection and submit again.', 'incomplete');
    }
    const accountRef = await ctx.rpc<string | null>('kyc_submitted', { p_customer: me, p_provider_ref: reference });
    if (accountRef) await alertCompliance(ctx.db, { title: 'New identity check', body: `${accountRef} · documents to review`, data: { customerId: me } });
    return { reference };
  },
});

if (import.meta.main) serve(handler);
