import { fnSchemas } from '@xrp/schemas';
import { customerId, sessionId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

const MAX_FAILURES_PER_15_MIN = 5;

/**
 * Second sign-in step with a backup code. On success this session is marked, and the access-token hook issues
 * aal2 for it on the next refresh (the app refreshes immediately). Each code works once.
 */
export const handler = defineFunction({
  name: 'mfa-backup-verify',
  schema: fnSchemas['mfa-backup-verify'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const me = customerId(ctx);
    const session = sessionId(ctx);
    if (!session) throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
    const since = new Date(ctx.now().getTime() - 15 * 60_000).toISOString();
    const { count } = await ctx.db
      .from('security_events')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', me)
      .eq('title', 'Backup code rejected')
      .gte('created_at', since);
    if ((count ?? 0) >= MAX_FAILURES_PER_15_MIN) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.', 'rate_limited');
    const ok = await ctx.rpc<boolean>('consume_backup_code', { p_user: me, p_code: ctx.input.code, p_session: session });
    if (!ok) await ctx.rpc('security_event', { p_customer: me, p_title: 'Backup code rejected' });
    return { ok };
  },
});

if (import.meta.main) serve(handler);
