import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './clients.ts';
import { hmacSha256, safeEqual } from './crypto.ts';
import { env } from './env.ts';
import { fromPg, HttpError, json } from './http.ts';

/** Callbacks older or newer than this are refused, so a captured request can't be replayed later. */
export const REPLAY_WINDOW_S = 300;

export type WebhookEvent = { id: string; type: string; [field: string]: unknown };

export type WebhookDeps = { db: SupabaseClient; secret: (provider: string) => string; now: () => Date };

export type WebhookContext = {
  event: WebhookEvent;
  db: SupabaseClient;
  /** Advances a transaction through transition_tx; a repeat of an already-applied step is a no-op. */
  transition: (transactionId: string, to: string, note?: string, meta?: Record<string, unknown>) => Promise<void>;
};

/**
 * Provider callback: `X-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`.
 * The raw body is stored in provider_events before anything else, so it can be replayed.
 */
export const defineWebhook =
  (provider: string, actor: string, handle: (ctx: WebhookContext) => Promise<void>) =>
  async (req: Request, deps: WebhookDeps = { db: serviceClient(), secret: env.webhookSecret, now: () => new Date() }): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
    const raw = await req.text();
    const header = req.headers.get('x-signature') ?? '';
    const parts = Object.fromEntries(header.split(',').map((kv) => kv.trim().split('=') as [string, string]));
    const t = Number(parts.t);
    const fresh = Number.isFinite(t) && Math.abs(deps.now().getTime() / 1000 - t) <= REPLAY_WINDOW_S;
    const valid = fresh && typeof parts.v1 === 'string' && safeEqual(parts.v1, await hmacSha256(deps.secret(provider), `${t}.${raw}`));

    let event: WebhookEvent;
    try {
      event = JSON.parse(raw) as WebhookEvent;
      if (typeof event.id !== 'string' || typeof event.type !== 'string') throw new Error('shape');
    } catch {
      return json(400, { error: 'Malformed event' });
    }

    const { error: storeError } = await deps.db.from('provider_events').insert({ provider, event_id: event.id, raw_body: raw, signature_valid: valid });
    if (storeError?.code === '23505') {
      const { data: prior } = await deps.db.from('provider_events').select('processed_at').match({ provider, event_id: event.id }).single();
      if ((prior as { processed_at: string | null } | null)?.processed_at) return json(200, { ok: true, duplicate: true });
      // Seen but not processed (an earlier attempt failed): process it now if this delivery is authentic.
    } else if (storeError) {
      console.error(storeError);
      return json(500, { error: 'Could not store event' });
    }
    if (!valid) return json(401, { error: 'Invalid or expired signature' });

    try {
      await handle({
        event,
        db: deps.db,
        transition: async (transactionId, to, note, meta = {}) => {
          const { data: tx } = await deps.db.from('transactions').select('status').eq('id', transactionId).single();
          if ((tx as { status: string } | null)?.status === to) return;
          const { error } = await deps.db.rpc('transition_tx', { p_tx: transactionId, p_to: to, p_actor: actor, p_note: note ?? null, p_meta: meta });
          if (error) throw fromPg(error);
        },
      });
    } catch (e) {
      const message = e instanceof HttpError ? e.message : 'Processing failed';
      console.error(provider, event.id, e);
      return json(e instanceof HttpError && e.status < 500 ? 422 : 500, { error: message });
    }
    await deps.db
      .from('provider_events')
      .update({ processed_at: deps.now().toISOString() })
      .match({ provider, event_id: event.id });
    return json(200, { ok: true });
  };

export const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || v === '') throw new HttpError(400, `Missing ${name}`);
  return v;
};
