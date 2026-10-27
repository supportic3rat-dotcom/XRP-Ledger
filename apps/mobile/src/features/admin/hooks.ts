import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { api } from '@/data';
import type { ActionResult, AdminData } from './data/types';
import { type StaffSession, useStaff } from './session';

/** The signed-in staff member. Only used under app/ops, whose layout guarantees a session. */
export const useStaffSession = (): StaffSession => {
  const s = useStaff((x) => x.session);
  if (!s) throw new Error('No staff session');
  return s;
};

/** A console read, refreshed every 30 seconds and after every action. */
export const useOps = <T>(key: string, read: (d: AdminData) => Promise<T>) => {
  const { data, me } = useStaffSession();
  return useQuery({ queryKey: ['ops', me.id, key], queryFn: () => read(data), refetchInterval: 30_000 });
};

/** Runs a console action, shows its message or error, then refreshes every console read. */
export const useOpsAction = () => {
  const qc = useQueryClient();
  const show = useToast((t) => t.show);
  const [pending, setPending] = useState(false);
  const run = async (action: () => Promise<ActionResult>, onOk?: () => void): Promise<ActionResult> => {
    setPending(true);
    try {
      const r = await action();
      if (r.ok) {
        if (r.message) show(r.message, { bottom: 104 });
        onOk?.();
      } else show(r.error, { bottom: 104 });
      await qc.invalidateQueries({ queryKey: ['ops'] });
      return r;
    } catch {
      show('Something went wrong. Try again.', { bottom: 104 });
      return { ok: false, error: 'Something went wrong. Try again.' };
    } finally {
      setPending(false);
    }
  };
  return { pending, run };
};

export const useStaffSignOut = () => {
  const qc = useQueryClient();
  const router = useRouter();
  const setSession = useStaff((s) => s.setSession);
  return async () => {
    await api.signOut().catch(() => undefined);
    setSession(null);
    qc.clear();
    router.replace('/welcome');
  };
};
