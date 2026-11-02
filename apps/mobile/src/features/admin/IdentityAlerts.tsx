import { useLastNotificationResponse } from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useToast } from '@/components/Toast';
import { staffPushToken } from '@/lib/staffPush';
import { useOps, useStaffSession } from './hooks';
import { opsRoute } from './routes';

/** Tells Compliance when an identity check arrives: a pop-up on any console screen, and phone notifications. Renders nothing. */
export const IdentityAlerts = () => {
  const { me, data } = useStaffSession();
  const router = useRouter();
  const opened = useLastNotificationResponse();
  const waiting = useOps('identity-waiting', (d) => d.identityWaiting()).data;
  const show = useToast((t) => t.show);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!waiting || me.role !== 'compliance') return;
    const fresh = waiting.filter((w) => !seen.current.has(w.id));
    seen.current = new Set(waiting.map((w) => w.id));
    if (fresh.length === 1) show(`New identity check: ${fresh[0]!.accountRef}`, { durationMs: 6000 });
    else if (fresh.length > 1) show(`${fresh.length} new identity checks waiting`, { durationMs: 6000 });
  }, [waiting, me.role, show]);

  useEffect(() => {
    if (me.role !== 'compliance') return;
    void staffPushToken().then((token) => (token ? data.registerPush(token) : undefined));
  }, [me.role, data]);

  const openedCustomer = opened?.notification.request.content.data?.customerId;
  useEffect(() => {
    if (typeof openedCustomer === 'string') router.push(opsRoute(`/users?sel=${openedCustomer}`));
  }, [openedCustomer, router]);

  return null;
};
