import { providerNames } from '@xrp/providers';
import { serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';
import { defineWebhook, str } from '../_shared/webhook.ts';

/**
 * [Lending provider]: loan funding, collateral locks and repayments. Collateral counts (and LTV changes)
 * only on `collateral.locked`; a repayment reduces the balance only on `repayment.applied`.
 */
export const handler = defineWebhook('lending', providerNames.lending, async ({ event, transition }) => {
  const tx = str(event.transactionId, 'transactionId');
  const reason = typeof event.reason === 'string' ? event.reason : undefined;
  switch (event.type) {
    case 'loan.collateral_locked':
      return transition(tx, 'collateral_locked');
    case 'loan.funded':
      await transition(tx, 'funded');
      return transition(tx, 'active');
    case 'loan.rejected':
      return transition(tx, 'rejected', reason);
    case 'collateral.locked':
      return transition(tx, 'lock_confirmed');
    case 'collateral.failed':
      return transition(tx, 'failed', reason);
    case 'repayment.received':
      return transition(tx, 'received');
    case 'repayment.applied':
      return transition(tx, 'applied');
    case 'repayment.failed':
      return transition(tx, 'failed', reason);
    default:
      throw new HttpError(400, `Unhandled event type ${event.type}`);
  }
});

if (import.meta.main) serve(handler);
