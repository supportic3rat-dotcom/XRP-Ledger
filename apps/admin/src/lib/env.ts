/** Public Supabase settings. Without them the console runs on demo data. The service role key is never used here. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};
export const hasBackend = (): boolean => Boolean(env.supabaseUrl && env.supabaseAnonKey);

/** Idle staff sessions end after 15 minutes (TDD). */
export const IDLE_LIMIT_MS = 15 * 60_000;
