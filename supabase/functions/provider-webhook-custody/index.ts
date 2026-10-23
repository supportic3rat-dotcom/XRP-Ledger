import { providerNames } from '@xrp/providers';
import { serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';
import { defineWebhook, str } from '../_shared/webhook.ts';

/**
 * [Custody provider] callbacks for withdrawals. They can move a withdrawal to `submitted` or `failed` only:
 * `validated` (shown as Completed) is set by the XRPL worker from a validated ledger, never from a callback.
 */
export const handler = defineWebhook('custody', providerNames.custody, ({ event, transition }) => {
  const tx = str(event.transactionId, 'transactionId');
  switch (event.type) {
    case 'transfer.submitted':
      return transition(tx, 'submitted', 'Signed and submitted', { transfer_id: str(event.transferId, 'transferId') });
    case 'transfer.failed':
      return transition(tx, 'failed', typeof event.reason === 'string' ? event.reason : 'Provider reported a failure');
    default:
      throw new HttpError(400, `Unhandled event type ${event.type}`);
  }
});

if (import.meta.main) serve(handler);
