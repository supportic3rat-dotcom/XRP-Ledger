import type { SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

type Alert = { title: string; body: string; data?: Record<string, string> };

/** Sends a phone alert to Compliance. Never throws: a customer's submission must not fail because an alert did. */
export const alertCompliance = async (db: SupabaseClient, alert: Alert): Promise<void> => {
  try {
    const { data } = await db.rpc('compliance_push_tokens');
    const tokens = ((data ?? []) as { token: string }[]).map((t) => t.token);
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify(batch.map((to) => ({ to, ...alert, sound: 'default', priority: 'high', channelId: 'alerts' }))),
      });
      const tickets = ((await res.json()) as { data?: { details?: { error?: string } }[] }).data ?? [];
      const gone = batch.filter((_, n) => tickets[n]?.details?.error === 'DeviceNotRegistered');
      if (gone.length) await db.from('staff_push_tokens').delete().in('token', gone);
    }
  } catch (e) {
    console.error('Compliance alert failed', e);
  }
};
