import type { SupabaseClient } from '@supabase/supabase-js';
import { createMockProviders } from '@xrp/providers';
import type { Deps } from '../_shared/handler.ts';
import { memoryIdempotencyStore } from '../_shared/idempotency.ts';

export type RpcCall = { fn: string; args: Record<string, unknown>; as: 'service' | 'user' };

type Result = { data: unknown; error: { code?: string; message: string } | null };

/** A Supabase client stand-in: records RPCs and answers them from `rpcs`; table reads return `tables`. */
export const fakeClient = (as: 'service' | 'user', calls: RpcCall[], rpcs: Record<string, (args: Record<string, unknown>) => Result>, tables: Record<string, unknown[]> = {}) => {
  const query = (table: string) => {
    const rows = tables[table] ?? [];
    const result = { data: rows[0] ?? null, error: null, count: rows.length };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'gt', 'gte', 'order', 'limit', 'match', 'update', 'insert', 'upsert', 'delete', 'in']) chain[m] = () => chain;
    chain.single = () => Promise.resolve(result);
    chain.maybeSingle = () => Promise.resolve(result);
    chain.then = (resolve: (r: unknown) => unknown) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve);
    return chain;
  };
  return {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args, as });
      const handler = rpcs[fn];
      return Promise.resolve(handler ? handler(args) : { data: null, error: null });
    },
    from: query,
  } as unknown as SupabaseClient;
};

export const token = (claims: Record<string, unknown>): string => {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;
};

export const CUSTOMER = '00000000-0000-4000-8000-000000000042';

export const fakeDeps = (
  opts: { rpcs?: Record<string, (args: Record<string, unknown>) => Result>; tables?: Record<string, unknown[]>; factors?: string[] } = {},
) => {
  const calls: RpcCall[] = [];
  const deps: Deps = {
    db: fakeClient('service', calls, opts.rpcs ?? {}, opts.tables),
    asUser: () => fakeClient('user', calls, opts.rpcs ?? {}, opts.tables),
    idempotency: memoryIdempotencyStore(),
    providers: createMockProviders({ latencyMs: 0 }),
    now: () => new Date('2026-10-19T11:50:00Z'),
    auth: {
      getUser: (authorization) => {
        const sub = JSON.parse(atob(authorization.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))).sub as string;
        return Promise.resolve({ id: sub, email: 'brendan@example.com', totpFactorIds: opts.factors ?? ['factor-1'] });
      },
      checkPassword: () => Promise.resolve(true),
    },
    cronSecret: () => 'cron-secret-for-tests',
    allowedOrigins: () => [],
  };
  return { deps, calls };
};

export const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/fn', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
