import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from '../env';

/** Server-side client acting as the signed-in staff member; RLS applies to every read. */
export const supabaseServer = async (): Promise<SupabaseClient> => {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
};

export type Claims = { sub: string; aal?: string; app_role?: string; email?: string };

export const claimsOf = (accessToken: string): Claims => {
  const part = accessToken.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Claims;
};
