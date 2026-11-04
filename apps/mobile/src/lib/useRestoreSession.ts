import { useEffect, useState } from 'react';
import { api } from '@/data';
import { supabase } from '@/data/supabaseApi';
import { resolveStaff, useStaff } from '@/features/admin/session';
import { hasBackend } from '@/lib/env';
import { useSession } from '@/state/session';
import { isSessionExpired, loadLastActive, markActive } from './lastActive';

const MAX_WAIT_MS = 4_000;

const tokenClaims = (token: string): { phrase?: string } => {
  try {
    const part = token.split('.')[1] ?? '';
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))) as { phrase?: string };
  } catch {
    return {};
  }
};

/** Reopens a session that's still inside the limit; an older one is ended, so the app opens on Welcome. */
const restore = async () => {
  const { data } = await supabase().auth.getSession();
  if (!data.session) return;
  await loadLastActive();
  if (isSessionExpired()) {
    await api.signOut().catch(() => undefined);
    return;
  }
  // Closed the app at the two-factor step: that session isn't signed in yet.
  const { data: level } = await supabase().auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.nextLevel === 'aal2' && level.currentLevel !== 'aal2') {
    await api.signOut().catch(() => undefined);
    return;
  }
  // Closed the app at the security-phrase step: the access-token hook marks that session.
  if (tokenClaims(data.session.access_token).phrase === 'required') {
    await api.signOut().catch(() => undefined);
    return;
  }
  markActive();
  const staff = await resolveStaff(data.session.user.email ?? '').catch(() => null);
  if (staff) useStaff.getState().setSession(staff);
  else useSession.getState().setSignedIn(true);
};

/** False until the session check is done (the splash stays up); a slow network never holds the app past MAX_WAIT_MS. */
export const useRestoreSession = (): boolean => {
  const [ready, setReady] = useState(!hasBackend());
  useEffect(() => {
    if (ready) return;
    const wait = new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS));
    void Promise.race([restore(), wait])
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
};
