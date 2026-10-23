/** An error whose message is safe to show the customer. Anything else becomes a generic 500. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'error',
  ) {
    super(message);
  }
}

export const corsHeaders = (origin: string | null, allowed: string[]): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin && (allowed.length === 0 || allowed.includes(origin)) ? origin : (allowed[0] ?? '*'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

/** JSON with bigint support: bigints travel as decimal strings, never as floats. */
export const toJson = (body: unknown): string => JSON.stringify(body, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));

export const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(toJson(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

type PgError = { code?: string; message?: string; details?: string | null; hint?: string | null };

/**
 * Maps a Postgres error from an RPC to an HTTP error. The SQL functions raise customer-facing copy with
 * these SQLSTATEs, so their messages pass through; anything unexpected is hidden.
 */
export const fromPg = (error: PgError): HttpError => {
  const message = error.message ?? 'Something went wrong';
  switch (error.code) {
    case 'P0001':
    case '22023':
    case '23514':
      return new HttpError(400, message, 'rejected');
    case '42501':
      return new HttpError(403, message, 'forbidden');
    case 'P0002':
      return new HttpError(404, message, 'not_found');
    case '23505':
      return new HttpError(409, 'This request was already submitted.', 'duplicate');
    case '40001':
    case '40P01':
      return new HttpError(503, 'Busy, try again.', 'retry');
    default:
      console.error('Unexpected database error', error);
      return new HttpError(500, 'Something went wrong on our side. Try again.', 'internal');
  }
};
