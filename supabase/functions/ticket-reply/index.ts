import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

export const handler = defineFunction({
  name: 'ticket-reply',
  schema: fnSchemas['ticket-reply'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    await ctx.rpc('ticket_reply', { p_customer: customerId(ctx), p_ref: ctx.input.ticketRef, p_message: ctx.input.message });
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
