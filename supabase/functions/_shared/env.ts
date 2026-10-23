/** Server-only configuration. The service role key never leaves Edge Functions and the worker. */
const required = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

export const env = {
  supabaseUrl: () => required('SUPABASE_URL'),
  anonKey: () => required('SUPABASE_ANON_KEY'),
  serviceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  /** Shared secret for scheduled calls (pg_cron → recon-run). */
  cronSecret: () => required('CRON_SECRET'),
  /** HMAC secret per provider webhook, e.g. WEBHOOK_SECRET_CUSTODY. */
  webhookSecret: (provider: string) => required(`WEBHOOK_SECRET_${provider.toUpperCase()}`),
  allowedOrigins: () => (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean),
};
