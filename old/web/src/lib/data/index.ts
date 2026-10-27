import { createDemoSource } from './demo';
import { createLiveSource } from './live';
import type { DashboardSource } from './types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Supabase when configured; otherwise demo mode with the design's sample account. */
export const createSource = (): DashboardSource => (url && anonKey ? createLiveSource(url, anonKey) : createDemoSource());
export const hasBackend = () => Boolean(url && anonKey);
