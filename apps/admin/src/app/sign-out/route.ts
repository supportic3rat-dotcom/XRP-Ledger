import { NextResponse } from 'next/server';
import { hasBackend } from '@/lib/env';
import { DEMO_ROLE_COOKIE } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';

export const POST = async (req: Request) => {
  if (hasBackend()) await (await supabaseServer()).auth.signOut();
  const res = NextResponse.redirect(new URL('/sign-in', req.url), 303);
  res.cookies.delete(DEMO_ROLE_COOKIE);
  return res;
};
