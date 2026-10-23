import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

/** Saves a withdrawal address. It activates after 24 hours. */
export const handler = defineFunction({
  name: 'allowlist-add',
  schema: fnSchemas['allowlist-add'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const screening = await ctx.providers.screening.screenAddress(ctx.input.address);
    if (screening.hold) throw new HttpError(400, 'We can’t save this address. Contact support if you think this is wrong.', 'screening');
    return ctx.rpc('allowlist_add', { p_customer: customerId(ctx), p_label: ctx.input.label, p_address: ctx.input.address, p_tag: ctx.input.tag,
      p_asset: ctx.input.asset, p_memo: ctx.input.memo ?? null });
  },
});

if (import.meta.main) serve(handler);
