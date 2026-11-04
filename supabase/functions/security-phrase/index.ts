import { type FnInput, fnSchemas, PHRASE_POOL, PHRASE_WORDS } from '@xrp/schemas';
import { customerId, sessionId } from '../_shared/customer.ts';
import { type Ctx, defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

const MAX_FAILURES_PER_15_MIN = 5;

/** 30 different words from the list, from a CSPRNG (Fisher–Yates on random 32-bit values). */
export const drawWords = (count = PHRASE_POOL): string[] => {
  const pool: string[] = [...PHRASE_WORDS];
  const r = crypto.getRandomValues(new Uint32Array(count));
  for (let i = 0; i < count; i++) {
    const j = i + ((r[i] ?? 0) % (pool.length - i));
    [pool[i], pool[j]] = [pool[j] as string, pool[i] as string];
  }
  return pool.slice(0, count);
};

const shuffle = (words: string[]): string[] => {
  const out = [...words];
  const r = crypto.getRandomValues(new Uint32Array(out.length));
  for (let i = out.length - 1; i > 0; i--) {
    const j = (r[i] ?? 0) % (i + 1);
    [out[i], out[j]] = [out[j] as string, out[i] as string];
  }
  return out;
};

type Input = FnInput<'security-phrase'>;

const refuseWhileOwed = (ctx: Ctx<Input>) => {
  if (ctx.claims?.phrase === 'required') throw new HttpError(403, 'Enter your security phrase to continue.', 'phrase_required');
};

/** Wrong guesses are security events; after 5 in 15 minutes the phrase can't be tried for a while. */
const checkRateLimit = async (ctx: Ctx<Input>, me: string) => {
  const since = new Date(ctx.now().getTime() - 15 * 60_000).toISOString();
  const { count } = await ctx.db
    .from('security_events')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', me)
    .eq('title', 'Security phrase rejected')
    .gte('created_at', since);
  if ((count ?? 0) >= MAX_FAILURES_PER_15_MIN) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.', 'rate_limited');
};

/**
 * The security phrase: set up, check and turn off. `challenge` and `verify` run on a session that still owes the
 * phrase (the sign-in step); after a match the app refreshes its token and the hook drops the `phrase` claim.
 */
export const handler = defineFunction({
  name: 'security-phrase',
  schema: fnSchemas['security-phrase'],
  access: { kind: 'customer', phraseStep: true },
  run: async (ctx) => {
    const me = customerId(ctx);
    const input = ctx.input;
    switch (input.action) {
      case 'challenge': {
        const { data } = await ctx.db.from('security_phrases').select('words, phrase_hash').eq('customer_id', me).maybeSingle();
        const row = data as { words: string[]; phrase_hash: string | null } | null;
        if (!row?.phrase_hash) return { enabled: false, words: [], verified: true };
        // The words come back in a new order every time, so where a word sits says nothing about the phrase.
        return { enabled: true, words: shuffle(row.words), verified: ctx.claims?.phrase !== 'required' };
      }
      case 'verify': {
        await checkRateLimit(ctx, me);
        const session = sessionId(ctx);
        if (!session) throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
        return { ok: await ctx.rpc<boolean>('phrase_check', { p_customer: me, p_words: input.words, p_session: session }) };
      }
      case 'setup': {
        refuseWhileOwed(ctx);
        const words = drawWords();
        await ctx.rpc('phrase_setup', { p_customer: me, p_words: words });
        return { words };
      }
      case 'enable': {
        refuseWhileOwed(ctx);
        await ctx.rpc('phrase_enable', { p_customer: me, p_words: input.words });
        return { ok: true };
      }
      case 'disable': {
        refuseWhileOwed(ctx);
        await checkRateLimit(ctx, me);
        return { ok: await ctx.rpc<boolean>('phrase_disable', { p_customer: me, p_words: input.words }) };
      }
    }
  },
});

if (import.meta.main) serve(handler);
