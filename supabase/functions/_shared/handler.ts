import type { SupabaseClient } from '@supabase/supabase-js';
import type { Providers } from '@xrp/providers';
import type { z } from 'zod';
import { serviceClient, userClient } from './clients.ts';
import { canonical, safeEqual, sha256 } from './crypto.ts';
import { env } from './env.ts';
import { corsHeaders, fromPg, HttpError, json, toJson } from './http.ts';
import { type IdempotencyStore, KEY_PATTERN, pgIdempotencyStore } from './idempotency.ts';
import { type AuthUser, checkPassword, fetchUser } from './auth.ts';
import { type Claims, readClaims } from './jwt.ts';
import { providers as defaultProviders } from './providers.ts';

export type Access =
  /** A signed-in customer. Email and password are the whole sign-in: there is no second step. */
  | { kind: 'customer' }
  /** Operations, Compliance or Auditor. */
  | { kind: 'staff'; roles?: readonly StaffRole[] }
  /** Staff, or the scheduler presenting CRON_SECRET. */
  | { kind: 'staff_or_cron'; roles?: readonly StaffRole[] }
  | { kind: 'public' };

export type StaffRole = 'operations' | 'compliance' | 'auditor';
const STAFF: readonly string[] = ['operations', 'compliance', 'auditor'];

export type Ctx<I> = {
  input: I;
  req: Request;
  claims: Claims | null;
  /** The verified caller. Null for public and cron calls. */
  user: AuthUser | null;
  /** auth.users id; for customers also `customers.id`. Null for public and cron calls. */
  userId: string | null;
  /** The caller's `Authorization` header, for Auth calls made on their behalf. */
  authorization: string | null;
  /** Client acting as the caller (RLS, app_role). Null for public and cron calls. */
  asUser: SupabaseClient | null;
  /** Service-role client. Never returned to callers. */
  db: SupabaseClient;
  idempotencyKey: string | null;
  providers: Providers;
  now: () => Date;
  auth: AuthApi;
  /** Calls an SQL function and maps its errors. `as: 'user'` runs it with the caller's JWT. */
  rpc: <T>(fn: string, args: Record<string, unknown>, as?: 'service' | 'user') => Promise<T>;
};

export type AuthApi = {
  getUser: (authorization: string) => Promise<AuthUser | null>;
  checkPassword: (email: string, password: string) => Promise<boolean>;
};

export type Deps = {
  db: SupabaseClient;
  asUser: (authorization: string) => SupabaseClient;
  idempotency: IdempotencyStore;
  providers: Providers;
  now: () => Date;
  auth: AuthApi;
  cronSecret: () => string;
  allowedOrigins: () => string[];
};

export type FunctionDef<S extends z.ZodType, R> = {
  name: string;
  schema: S;
  access: Access;
  /** Requires an Idempotency-Key header; a retry replays the first response. */
  idempotent?: boolean;
  run: (ctx: Ctx<z.infer<S>>) => Promise<R>;
};

export const defaultDeps = (): Deps => {
  const db = serviceClient();
  return {
    db,
    asUser: userClient,
    idempotency: pgIdempotencyStore(db),
    providers: defaultProviders(),
    now: () => new Date(),
    auth: { getUser: fetchUser, checkPassword },
    cronSecret: env.cronSecret,
    allowedOrigins: env.allowedOrigins,
  };
};

type Caller = { claims: Claims | null; user: AuthUser | null; authorization: string | null };
const anonymous: Caller = { claims: null, user: null, authorization: null };

const authenticate = async (req: Request, access: Access, deps: Deps): Promise<Caller> => {
  if (access.kind === 'public') return anonymous;
  if (access.kind === 'staff_or_cron') {
    const secret = req.headers.get('x-cron-secret');
    if (secret !== null) {
      if (!safeEqual(secret, deps.cronSecret())) throw new HttpError(401, 'Not authorised.', 'unauthorised');
      return anonymous;
    }
  }
  const authorization = req.headers.get('authorization');
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!authorization || !token) throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
  let claims: Claims;
  try {
    claims = readClaims(token);
  } catch {
    throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
  }
  const user = await deps.auth.getUser(authorization);
  if (!user || user.id !== claims.sub) throw new HttpError(401, 'Your session ended. Sign in again.', 'unauthenticated');

  const role = claims.app_role ?? 'customer';
  if (access.kind === 'customer') {
    if (STAFF.includes(role)) throw new HttpError(403, 'Staff accounts cannot use customer actions.', 'forbidden');
  } else {
    if (!STAFF.includes(role)) throw new HttpError(403, 'Not authorised.', 'forbidden');
    if (access.roles && !access.roles.includes(role as StaffRole)) throw new HttpError(403, 'Your role cannot do this.', 'forbidden');
  }
  return { claims, user, authorization };
};

/** Wraps a function: CORS, auth, Zod validation, idempotency, error mapping. */
export const defineFunction =
  <S extends z.ZodType, R>(def: FunctionDef<S, R>) =>
  async (req: Request, deps: Deps = defaultDeps()): Promise<Response> => {
    const cors = corsHeaders(req.headers.get('origin'), deps.allowedOrigins());
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let scope: { userId: string; fn: string; key: string } | null = null;
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST.', 'method');
      const { claims, user, authorization } = await authenticate(req, def.access, deps);

      const body: unknown = await req.json().catch(() => {
        throw new HttpError(400, 'The request body must be JSON.', 'invalid');
      });
      const parsed = def.schema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new HttpError(400, first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request.', 'invalid');
      }

      const idempotencyKey = req.headers.get('idempotency-key');
      if (def.idempotent) {
        if (!idempotencyKey || !KEY_PATTERN.test(idempotencyKey)) throw new HttpError(400, 'An Idempotency-Key header is required.', 'idempotency_key');
        if (!claims) throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
        scope = { userId: claims.sub, fn: def.name, key: idempotencyKey };
        const hit = await deps.idempotency.claim(scope, await sha256(canonical(parsed.data)));
        if (hit.state === 'replay') return json(200, hit.response, { ...cors, 'Idempotent-Replayed': 'true' });
        if (hit.state === 'in_flight') {
          scope = null; // not ours to release
          throw new HttpError(409, 'This request is still being processed.', 'in_flight');
        }
      }

      const asUser = authorization ? deps.asUser(authorization) : null;
      const ctx: Ctx<z.infer<S>> = {
        input: parsed.data,
        req,
        claims,
        user,
        userId: user?.id ?? null,
        authorization,
        asUser,
        db: deps.db,
        idempotencyKey,
        providers: deps.providers,
        now: deps.now,
        auth: deps.auth,
        rpc: async <T>(fn: string, args: Record<string, unknown>, as: 'service' | 'user' = 'service') => {
          const client = as === 'user' ? asUser : deps.db;
          if (!client) throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
          const { data, error } = await client.rpc(fn, args);
          if (error) throw fromPg(error);
          return data as T;
        },
      };
      const result = await def.run(ctx);
      // Round-trip through JSON so the stored replay is byte-identical to the first response.
      const payload: unknown = JSON.parse(toJson(result ?? { ok: true }));
      if (scope) await deps.idempotency.complete(scope, payload);
      return json(200, payload, cors);
    } catch (e) {
      if (scope) await deps.idempotency.release(scope).catch(() => undefined);
      const err = e instanceof HttpError ? e : isPg(e) ? fromPg(e) : unexpected(e);
      return json(err.status, { error: err.message, code: err.code }, cors);
    }
  };

const isPg = (e: unknown): e is { code: string; message: string } => typeof e === 'object' && e !== null && 'code' in e && 'message' in e && !(e instanceof Error);

const unexpected = (e: unknown): HttpError => {
  console.error(e);
  return new HttpError(500, 'Something went wrong on our side. Try again.', 'internal');
};

/** Entry point used by each function's index.ts. */
export const serve = (handler: (req: Request) => Promise<Response>): void => {
  Deno.serve((req) => handler(req));
};
