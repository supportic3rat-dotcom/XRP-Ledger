import { fnSchemas } from '@xrp/schemas';
import { customerId, sessionId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Signs a device out: its session and refresh tokens are deleted. */
export const handler = defineFunction({
  name: 'device-revoke',
  schema: fnSchemas['device-revoke'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    await ctx.rpc('device_revoke', { p_customer: customerId(ctx), p_device: ctx.input.deviceId, p_current_session: sessionId(ctx) });
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
