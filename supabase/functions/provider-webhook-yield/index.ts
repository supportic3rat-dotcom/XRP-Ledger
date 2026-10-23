import { providerNames } from '@xrp/providers';
import { serve } from '../_shared/handler.ts';
import { fromPg, HttpError } from '../_shared/http.ts';
import { defineWebhook, str } from '../_shared/webhook.ts';

type StatementLine = { customerRef: string; grossDrops: string; asset?: string };

/** [Yield provider]: allocation/redemption confirmations and reward statements. */
export const handler = defineWebhook('yield', providerNames.yield, async ({ event, db, transition }) => {
  switch (event.type) {
    case 'allocation.confirmed':
    case 'redemption.confirmed':
      return transition(str(event.transactionId, 'transactionId'), 'confirmed');
    case 'allocation.failed':
    case 'redemption.failed':
      return transition(str(event.transactionId, 'transactionId'), 'provider_failed', typeof event.reason === 'string' ? event.reason : undefined);
    case 'statement.posted': {
      const lines = event.lines as StatementLine[] | undefined;
      if (!Array.isArray(lines)) throw new HttpError(400, 'Missing lines');
      const period = str(event.period, 'period');
      for (const [i, line] of lines.entries()) {
        if (!/^\d+$/.test(line.grossDrops)) throw new HttpError(400, `Line ${i}: grossDrops must be integer drops`);
        const { error } = await db.rpc('record_yield_reward', {
          p_account_ref: line.customerRef,
          p_gross_drops: line.grossDrops,
          p_period: period,
          p_event: `${event.id}:${i}`,
          p_asset: line.asset ?? 'XRP',
        });
        if (error) throw fromPg(error);
      }
      return;
    }
    default:
      throw new HttpError(400, `Unhandled event type ${event.type}`);
  }
});

if (import.meta.main) serve(handler);
