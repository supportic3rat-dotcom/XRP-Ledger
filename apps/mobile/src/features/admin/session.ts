import { create } from 'zustand';
import { supabase } from '@/data/supabaseApi';
import { hasBackend } from '@/lib/env';
import { createDemoData } from './data/demo';
import { createSupabaseData } from './data/supabase';
import { ROLES, type AdminData, type Role, type Staff } from './data/types';

export type StaffSession = { me: Staff; data: AdminData };

/** Demo backend only: the two staff sign-ins from the owner, mapped to the roles a two-person approval needs. */
const DEMO_STAFF_EMAILS: Record<string, Role> = {
  'support.xrp@gmail.com': 'operations',
  'support.xrp+compliance@gmail.com': 'compliance',
};

const isRole = (v: unknown): v is Role => typeof v === 'string' && v in ROLES;

/** `app_role` from the access token. The custom access token hook adds it for staff only. */
const roleFromToken = (token: string): Role | null => {
  try {
    const part = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))) as { app_role?: unknown };
    return isRole(claims.app_role) ? claims.app_role : null;
  } catch {
    return null;
  }
};

/** After a successful sign-in: the staff member and their console data, or null for a customer. */
export const resolveStaff = async (email: string): Promise<StaffSession | null> => {
  if (!hasBackend()) {
    const role = DEMO_STAFF_EMAILS[email.trim().toLowerCase()];
    if (!role) return null;
    const data = createDemoData(role);
    const me = await data.me();
    return me ? { me, data } : null;
  }
  const db = supabase();
  const { data: s } = await db.auth.getSession();
  const role = s.session ? roleFromToken(s.session.access_token) : null;
  if (!s.session || !role) return null;
  const { data: staff } = await db.from('staff_roles').select('display_name').eq('staff_id', s.session.user.id).single();
  const me: Staff = { id: s.session.user.id, name: (staff as { display_name: string } | null)?.display_name ?? 'Staff', role };
  return { me, data: createSupabaseData(db, me) };
};

type StaffState = { session: StaffSession | null; setSession: (s: StaffSession | null) => void };

/** The signed-in staff member, kept in memory only: closing the app ends the console session. */
export const useStaff = create<StaffState>()((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));

/** Idle staff sessions end after 15 minutes (TDD). */
export const IDLE_LIMIT_MS = 15 * 60_000;
