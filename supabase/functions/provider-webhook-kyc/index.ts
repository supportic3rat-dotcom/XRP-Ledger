import { providerNames } from '@xrp/providers';
import { serve } from '../_shared/handler.ts';
import { fromPg, HttpError } from '../_shared/http.ts';
import { defineWebhook, str } from '../_shared/webhook.ts';

const DECISIONS = ['in_progress', 'more_info', 'verified', 'rejected'] as const;

/** [KYC provider] decision callback (the TDD's `kyc-webhook`). Updates the customer and notifies them. */
export const handler = defineWebhook('kyc', providerNames.kyc, async ({ event, db }) => {
  if (event.type !== 'verification.decided') throw new HttpError(400, `Unhandled event type ${event.type}`);
  const decision = str(event.decision, 'decision');
  if (!(DECISIONS as readonly string[]).includes(decision)) throw new HttpError(400, `Unknown decision ${decision}`);
  const { error } = await db.rpc('kyc_decided', { p_provider_ref: str(event.sessionId, 'sessionId'), p_decision: decision });
  if (error) throw fromPg(error);
});

if (import.meta.main) serve(handler);
