import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.ts';

export type IdempotencyHit = { state: 'new' } | { state: 'replay'; response: unknown } | { state: 'in_flight' };

export type IdempotencyStore = {
  claim(scope: { userId: string; fn: string; key: string }, requestHash: string): Promise<IdempotencyHit>;
  complete(scope: { userId: string; fn: string; key: string }, response: unknown): Promise<void>;
  release(scope: { userId: string; fn: string; key: string }): Promise<void>;
};

export const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Stores each (user, function, key) once. A retry with the same body replays the stored response;
 * the same key with a different body is refused. Money RPCs are also unique on (customer, key),
 * so a race between two first attempts still posts once.
 */
export const pgIdempotencyStore = (db: SupabaseClient): IdempotencyStore => ({
  claim: async ({ userId, fn, key }, requestHash) => {
    const { error } = await db.from('idempotency_keys').insert({ user_id: userId, function_name: fn, key, request_hash: requestHash });
    if (!error) return { state: 'new' };
    if (error.code !== '23505') throw error;
    const { data, error: readError } = await db
      .from('idempotency_keys')
      .select('request_hash, response')
      .match({ user_id: userId, function_name: fn, key })
      .single();
    if (readError) throw readError;
    const row = data as { request_hash: string; response: unknown };
    if (row.request_hash !== requestHash) throw new HttpError(422, 'This Idempotency-Key was already used for a different request.', 'idempotency_mismatch');
    return row.response === null ? { state: 'in_flight' } : { state: 'replay', response: row.response };
  },
  complete: async ({ userId, fn, key }, response) => {
    await db.from('idempotency_keys').update({ response }).match({ user_id: userId, function_name: fn, key });
  },
  release: async ({ userId, fn, key }) => {
    await db.from('idempotency_keys').delete().match({ user_id: userId, function_name: fn, key }).is('response', null);
  },
});

export const memoryIdempotencyStore = (): IdempotencyStore => {
  const rows = new Map<string, { hash: string; response: unknown }>();
  const id = (s: { userId: string; fn: string; key: string }) => `${s.userId}|${s.fn}|${s.key}`;
  return {
    claim: (scope, hash) => {
      const row = rows.get(id(scope));
      if (!row) {
        rows.set(id(scope), { hash, response: null });
        return Promise.resolve({ state: 'new' });
      }
      if (row.hash !== hash) return Promise.reject(new HttpError(422, 'This Idempotency-Key was already used for a different request.', 'idempotency_mismatch'));
      return Promise.resolve(row.response === null ? { state: 'in_flight' } : { state: 'replay', response: row.response });
    },
    complete: (scope, response) => {
      const row = rows.get(id(scope));
      if (row) row.response = response;
      return Promise.resolve();
    },
    release: (scope) => {
      if (rows.get(id(scope))?.response === null) rows.delete(id(scope));
      return Promise.resolve();
    },
  };
};
