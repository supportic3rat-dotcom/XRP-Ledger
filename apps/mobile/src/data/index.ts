import { hasBackend } from '@/lib/env';
import type { Api } from './api';
import { demoApi } from './demo/demoApi';
import { createSupabaseApi } from './supabaseApi';

/** Supabase when EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are set; otherwise the local demo backend seeded with the design's sample data. */
export const api: Api = hasBackend() ? createSupabaseApi() : demoApi;
export type { Api } from './api';
