import { assertEquals } from 'jsr:@std/assert@1';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hmacSha256 } from '../_shared/crypto.ts';
import { handler as custody } from '../provider-webhook-custody/index.ts';

const SECRET = 'whsec-test';
const NOW = new Date('2026-10-19T11:50:00Z');

/** provider_events + transactions + transition_tx, in memory. */
const fakeDb = () => {
  const events = new Map<string, { processed_at: string | null }>();
  const transitions: string[] = [];
  let status = 'approved';
  const db = {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const chain = {
        insert: (row: { event_id: string }) => {
          if (events.has(row.event_id)) return Promise.resolve({ error: { code: '23505', message: 'duplicate' } });
          events.set(row.event_id, { processed_at: null });
          return Promise.resolve({ error: null });
        },
        update: (patch: { processed_at: string }) => ({
          match: (m: { event_id: string }) => {
            events.set(m.event_id, { processed_at: patch.processed_at });
            return Promise.resolve({ error: null });
          },
        }),
        select: () => chain,
        eq: () => chain,
        match: (m: Record<string, unknown>) => Object.assign(filters, m) && chain,
        single: () =>
          Promise.resolve(
            table === 'transactions' ? { data: { status }, error: null } : { data: events.get(String(filters.event_id)) ?? null, error: null },
          ),
      };
      return chain;
    },
    rpc: (_fn: string, args: { p_to: string }) => {
      transitions.push(args.p_to);
      status = args.p_to;
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
  return { db, transitions, events };
};

const signed = async (body: object, at = NOW, secret = SECRET) => {
  const raw = JSON.stringify(body);
  const t = Math.floor(at.getTime() / 1000);
  return new Request('http://localhost/hook', { method: 'POST', body: raw, headers: { 'x-signature': `t=${t},v1=${await hmacSha256(secret, `${t}.${raw}`)}` } });
};

const event = { id: 'evt_1', type: 'transfer.submitted', transactionId: 'tx-1', transferId: 'tr-9' };

Deno.test('a valid callback is stored, applied once, and a redelivery is a no-op', async () => {
  const f = fakeDb();
  const deps = { db: f.db, secret: () => SECRET, now: () => NOW };
  assertEquals((await custody(await signed(event), deps)).status, 200);
  const again = await custody(await signed(event), deps);
  assertEquals((await again.json()).duplicate, true);
  assertEquals(f.transitions, ['submitted']);
});

Deno.test('a bad signature is stored for review but not applied', async () => {
  const f = fakeDb();
  const res = await custody(await signed(event, NOW, 'wrong'), { db: f.db, secret: () => SECRET, now: () => NOW });
  assertEquals(res.status, 401);
  assertEquals(f.events.has('evt_1'), true);
  assertEquals(f.transitions, []);
});

Deno.test('a callback outside the 5-minute replay window is refused', async () => {
  const f = fakeDb();
  const old = new Date(NOW.getTime() - 6 * 60_000);
  const res = await custody(await signed(event, old), { db: f.db, secret: () => SECRET, now: () => NOW });
  assertEquals(res.status, 401);
  assertEquals(f.transitions, []);
});

Deno.test('custody can never mark a withdrawal validated', async () => {
  const f = fakeDb();
  const res = await custody(await signed({ ...event, id: 'evt_2', type: 'transfer.validated' }), { db: f.db, secret: () => SECRET, now: () => NOW });
  assertEquals(res.status, 422);
  assertEquals(f.transitions, []);
});
