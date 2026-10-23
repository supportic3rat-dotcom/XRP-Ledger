export type Claims = {
  sub: string;
  email?: string;
  role?: string;
  aal?: 'aal1' | 'aal2';
  session_id?: string;
  app_role?: 'customer' | 'operations' | 'compliance' | 'auditor';
  exp?: number;
};

/**
 * Reads claims from a token the platform has already verified (verify_jwt) and that `auth.getUser`
 * re-checks below. Never trusted on its own.
 */
export const readClaims = (token: string): Claims => {
  const part = token.split('.')[1];
  if (!part) throw new Error('Malformed token');
  const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0)))) as Claims;
};
