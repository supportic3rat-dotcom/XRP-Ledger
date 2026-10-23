import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';
import { ticketView } from '../_shared/tickets.ts';

const PER_EMAIL_PER_HOUR = 3;

/** Support form for people who can't sign in. Rate-limited per email; staff read it from the admin console. */
export const handler = defineFunction({
  name: 'ticket-create-public',
  schema: fnSchemas['ticket-create-public'],
  access: { kind: 'public' },
  run: async (ctx) => {
    const email = ctx.input.email.toLowerCase();
    const since = new Date(ctx.now().getTime() - 3_600_000).toISOString();
    const { count } = await ctx.db.from('public_contact_requests').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since);
    if ((count ?? 0) >= PER_EMAIL_PER_HOUR) throw new HttpError(429, 'You’ve sent a few messages already. We’ll reply by email soon.', 'rate_limited');
    const { data, error } = await ctx.db
      .from('public_contact_requests')
      .insert({ email, topic: ctx.input.topic, message: ctx.input.message })
      .select('id, created_at')
      .single();
    if (error) throw error;
    const row = data as { id: string; created_at: string };
    return ticketView(
      { ref: `Ref ${row.id.slice(0, 8).toUpperCase()}`, subject: ctx.input.message.slice(0, 60), topic: ctx.input.topic, transaction_ref: null, created_at: row.created_at, status: 'waiting_on_us' },
      ctx.input.message,
    );
  },
});

if (import.meta.main) serve(handler);
