import type { QueueItem, QueueKind, Tone } from './types';

/** Status shown for a queue item, from its approvals and decision (same rule as approval_decide). */
export const queueStatus = (it: QueueItem): [string, Tone] => {
  if (it.decided?.kind === 'rejected') return ['Rejected', 'bad'];
  if (it.approvals.length >= it.required) return ['Approved', 'ok'];
  if (it.required > 1) return [`Awaiting ${it.approvals.length + 1} of ${it.required}`, 'wait'];
  return ['Awaiting review', 'wait'];
};

const NEXT_STEP: Record<QueueKind, string> = {
  withdrawal: 'Queued for custody submission. Shows Completed only after the transaction is validated on the ledger.',
  deposit: 'Attribution approved. Credit posts as a balanced journal entry and is queued for reconciliation.',
  exchange: 'Approved to request a firm quote. Customer must accept it before XRP is reserved.',
  loan: 'Forwarded to the lending provider. Nothing is funded until the provider settles.',
  yield: 'Sent to the yield provider. XRP moves to Allocated only after the provider confirms.',
};
export const nextStep = (kind: QueueKind): string => NEXT_STEP[kind];
