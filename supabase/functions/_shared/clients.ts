import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.ts';

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** Bypasses RLS. Used only after the caller is authenticated and authorised in code or SQL. */
export const serviceClient = (): SupabaseClient => createClient(env.supabaseUrl(), env.serviceRoleKey(), { auth: noSession });

/** Acts as the caller: RLS and `app_role()` see their JWT. Staff RPCs run through this. */
export const userClient = (authorization: string): SupabaseClient =>
  createClient(env.supabaseUrl(), env.anonKey(), { auth: noSession, global: { headers: { Authorization: authorization } } });
