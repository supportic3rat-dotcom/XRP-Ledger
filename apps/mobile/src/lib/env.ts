/** Public config only. The service-role key must never appear here. */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};
export const hasBackend = (): boolean => env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
