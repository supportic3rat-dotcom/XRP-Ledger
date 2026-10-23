import type { Ctx } from './handler.ts';
import { HttpError } from './http.ts';

/** customers.id is the auth user id. */
export const customerId = (ctx: Ctx<unknown>): string => {
  if (!ctx.userId) throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
  return ctx.userId;
};

export const sessionId = (ctx: Ctx<unknown>): string | null => ctx.claims?.session_id ?? null;

/**
 * Registers or refreshes this session's device. Returns whether withdrawals from it are paused
 * (a new device waits 24 hours, unless it is the customer's first).
 */
export const touchDevice = async (ctx: Ctx<unknown>): Promise<{ paused: boolean }> => {
  const session = sessionId(ctx);
  if (!session) return { paused: false };
  const name = ctx.req.headers.get('x-device-name') ?? 'Unknown device';
  const kind = ctx.req.headers.get('x-device-kind') === 'laptop' ? 'laptop' : 'phone';
  // The device's own hint (city) plus the country the edge network saw the request from, which the client can't set.
  const hint = ctx.req.headers.get('x-device-location');
  const country = ctx.req.headers.get('cf-ipcountry');
  const seen = country && country !== 'XX' ? country.toUpperCase() : null;
  const location = [hint, seen].filter(Boolean).join(', ') || 'Location unavailable';
  const d = await ctx.rpc<{ withdrawals_paused_until: string | null }>('touch_device', {
    p_customer: customerId(ctx),
    p_session: session,
    p_name: name,
    p_kind: kind,
    p_location: location,
  });
  return { paused: d.withdrawals_paused_until !== null && Date.parse(d.withdrawals_paused_until) > ctx.now().getTime() };
};

/** The latest market price in micro-USD, refused when stale (no money action runs on an old price). */
export const currentPriceMicro = async (ctx: Ctx<unknown>, asset = 'XRP'): Promise<bigint> => {
  const { data } = await ctx.db.from('prices').select('usd_micro, at').eq('asset', asset).order('at', { ascending: false }).limit(1).maybeSingle();
  const row = data as { usd_micro: number | string; at: string } | null;
  if (!row || ctx.now().getTime() - Date.parse(row.at) > 15 * 60_000) {
    throw new HttpError(503, 'Prices are temporarily unavailable. Try again in a few minutes.', 'stale_price');
  }
  return BigInt(String(row.usd_micro));
};

export type TxRow = {
  id: string;
  ref: string;
  status: string;
  customer_id: string;
  kind: string;
  asset: string;
  counter_asset: string | null;
  amount_drops: number | null;
  amount_cents: number | null;
  meta: Record<string, unknown>;
};
