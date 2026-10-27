/** Public config only. The service-role key must never appear here. */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};
/** `pnpm start:dashboard` (EXPO_PUBLIC_SKIP_AUTH=1, development builds only): demo data, already signed in, even when Supabase is configured. */
export const skipAuth = (): boolean => __DEV__ && process.env.EXPO_PUBLIC_SKIP_AUTH === '1';
export const hasBackend = (): boolean => !skipAuth() && env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
