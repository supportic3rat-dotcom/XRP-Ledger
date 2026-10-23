import { env } from './env.ts';

export type AuthUser = { id: string; email: string | null; totpFactorIds: string[] };

type GoTrueUser = { id: string; email?: string; factors?: { id: string; factor_type: string; status: string }[] };

const authFetch = (path: string, authorization: string, init: RequestInit = {}): Promise<Response> =>
  fetch(`${env.supabaseUrl()}/auth/v1${path}`, {
    ...init,
    headers: { Authorization: authorization, apikey: env.anonKey(), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

/** Re-validates the token with Auth (catches signed-out sessions) and returns the verified TOTP factors. */
export const fetchUser = async (authorization: string): Promise<AuthUser | null> => {
  const res = await authFetch('/user', authorization);
  if (!res.ok) return null;
  const user = (await res.json()) as GoTrueUser;
  return {
    id: user.id,
    email: user.email ?? null,
    totpFactorIds: (user.factors ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'verified').map((f) => f.id),
  };
};

/** Confirms the current password without creating a lasting session. */
export const checkPassword = async (email: string, password: string): Promise<boolean> => {
  const res = await fetch(`${env.supabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.anonKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return false;
  const { access_token } = (await res.json()) as { access_token: string };
  await authFetch('/logout?scope=local', `Bearer ${access_token}`, { method: 'POST' });
  return true;
};
