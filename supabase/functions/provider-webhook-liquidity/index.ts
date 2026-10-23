import { providerNames } from '@xrp/providers';
import { serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';
import { defineWebhook, str } from '../_shared/webhook.ts';

/** [Liquidity provider] fills and [Bank / payout provider] settlements for exchanges. */
export const handler = defineWebhook('liquidity', providerNames.liquidity, ({ event, transition }) => {
  const tx = str(event.transactionId, 'transactionId');
  switch (event.type) {
    case 'execution.filled':
      return transition(tx, 'sold', undefined, { execution_id: str(event.executionId, 'executionId') });
    case 'payout.settled':
      return transition(tx, 'paid_out', `Paid by ${providerNames.payout}`, { payout_id: str(event.payoutId, 'payoutId') });
    default:
      throw new HttpError(400, `Unhandled event type ${event.type}`);
  }
});

if (import.meta.main) serve(handler);
