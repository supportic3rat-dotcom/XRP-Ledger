import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';
import { ticketView } from '../_shared/tickets.ts';

type TicketRow = { ref: string; subject: string; topic: string; transaction_ref: string | null; created_at: string; status: string };

export const handler = defineFunction({
  name: 'ticket-create',
  schema: fnSchemas['ticket-create'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const t = await ctx.rpc<TicketRow>('ticket_create', {
      p_customer: customerId(ctx),
      p_topic: ctx.input.topic,
      p_transaction_ref: ctx.input.transactionRef,
      p_message: ctx.input.message,
    });
    return ticketView(t, ctx.input.message);
  },
});

if (import.meta.main) serve(handler);
