import { fnSchemas } from '@xrp/schemas';
import { customerId, touchDevice, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Withdraw: one SQL transaction that checks limits and the allowlist, reserves the funds and opens the approval.
 * There's no screening service: the approver checks the destination address by hand (a manual check on the approval).
 */
export const handler = defineFunction({
  name: 'withdraw-request',
  schema: fnSchemas['withdraw-request'],
  access: { kind: 'customer' },
  idempotent: true,
  run: async (ctx) => {
    const { asset, amountDrops, destination, destinationTag, memo, network } = ctx.input;
    const { paused } = await touchDevice(ctx);
    const tx = await ctx.rpc<TxRow>('request_withdrawal', {
      p_customer: customerId(ctx),
      p_amount_drops: amountDrops,
      p_destination: destination,
      p_tag: destinationTag,
      p_idempotency_key: ctx.idempotencyKey,
      p_device_paused: paused,
      p_asset: asset,
      p_memo: memo ?? null,
      p_network: network ?? null,
    });
    // Manual screening: the reviewer checks the address before approving (owner's decision, 2026-10-28).
    const { data: approval } = await ctx.db.from('approvals').select('checks').eq('transaction_id', tx.id).single();
    const checks = ((approval as { checks: unknown[] } | null)?.checks ?? []).concat([
      [
        'Check the destination address',
        `Look up ${destination.slice(0, 10)}… in a block explorer and against sanctions and stolen-funds lists before approving`,
        'wait',
      ],
    ]);
    await ctx.db.from('approvals').update({ checks }).eq('transaction_id', tx.id);
    return { transaction: tx };
  },
});

if (import.meta.main) serve(handler);
