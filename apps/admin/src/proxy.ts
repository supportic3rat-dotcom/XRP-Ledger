import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { env, hasBackend, IDLE_LIMIT_MS } from './lib/env';

const LAST_SEEN = 'xrp_last_seen';

/**
 * Refreshes the staff session on every request, ends it after 15 idle minutes, and sends anyone without a
 * session to sign-in. Pages check aal2 and the staff role again on the server.
 */
export const proxy = async (req: NextRequest) => {
  if (!hasBackend()) return NextResponse.next();
  let res = NextResponse.next({ request: req });
  const db = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await db.auth.getUser();
  const signingIn = req.nextUrl.pathname.startsWith('/sign-in');
  if (!data.user) return signingIn ? res : NextResponse.redirect(new URL('/sign-in', req.url));

  const last = Number(req.cookies.get(LAST_SEEN)?.value ?? Date.now());
  if (!signingIn && Date.now() - last > IDLE_LIMIT_MS) {
    await db.auth.signOut();
    const out = NextResponse.redirect(new URL('/sign-in?reason=idle', req.url));
    out.cookies.delete(LAST_SEEN);
    return out;
  }
  res.cookies.set(LAST_SEEN, String(Date.now()), { httpOnly: true, sameSite: 'strict', path: '/', secure: process.env.NODE_ENV === 'production' });
  return res;
};

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
