import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createDemoData } from './data/demo';
import { createSupabaseData } from './data/supabase';
import type { AdminData, Role, Staff } from './data/types';
import { hasBackend } from './env';
import { claimsOf, supabaseServer } from './supabase/server';

export const DEMO_ROLE_COOKIE = 'xrp_demo_role';
const ROLES: Role[] = ['operations', 'compliance', 'auditor'];

/**
 * The signed-in staff member and their data source, once per request. Supabase mode requires a TOTP-verified
 * (aal2) session with a staff role; anything else goes to sign-in.
 */
export const session = cache(async (): Promise<{ me: Staff; data: AdminData }> => {
  if (!hasBackend()) {
    const value = (await cookies()).get(DEMO_ROLE_COOKIE)?.value;
    const role: Role = ROLES.includes(value as Role) ? (value as Role) : 'operations';
    const data = createDemoData(role);
    const me = await data.me();
    if (!me) redirect('/sign-in');
    return { me, data };
  }
  const db = await supabaseServer();
  const { data: user } = await db.auth.getUser();
  const { data: s } = await db.auth.getSession();
  if (!user.user || !s.session) redirect('/sign-in');
  const claims = claimsOf(s.session.access_token);
  if (claims.aal !== 'aal2' || !ROLES.includes(claims.app_role as Role)) redirect('/sign-in?reason=mfa');
  const { data: staff } = await db.from('staff_roles').select('display_name').eq('staff_id', user.user.id).single();
  const me: Staff = { id: user.user.id, name: (staff as { display_name: string } | null)?.display_name ?? 'Staff', role: claims.app_role as Role };
  return { me, data: createSupabaseData(db, me, s.session.access_token) };
});
