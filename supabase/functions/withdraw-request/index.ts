import { fnSchemas } from '@xrp/schemas';
import { customerId, touchDevice, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Withdraw: 2FA code → screening → one SQL transaction that checks limits and the allowlist, reserves
 * the funds and opens the approval. The worker submits it only after staff approval.
 */
export const handler = defineFunction({
  name: 'withdraw-request',
  schema: fnSchemas['withdraw-request'],
  access: { kind: 'customer' },
  idempotent: true,
  run: async (ctx) => {
    const { asset, amountDrops, destination, destinationTag, memo, network } = ctx.input;
    const { paused } = await touchDevice(ctx);
    const screening = await ctx.providers.screening.screenAddress(destination);
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
    // Screening goes on the approval for the reviewer; a hit holds it there rather than failing the request.
    const { data: approval } = await ctx.db.from('approvals').select('checks').eq('transaction_id', tx.id).single();
    const checks = ((approval as { checks: unknown[] } | null)?.checks ?? []).concat([
      [
        screening.hold ? 'Destination flagged by screening' : 'Destination screened',
        `[Screening provider] · ${screening.risk} risk · ${screening.reference}`,
        screening.hold ? 'bad' : screening.risk === 'low' ? 'ok' : 'warn',
      ],
    ]);
    await ctx.db.from('approvals').update({ checks }).eq('transaction_id', tx.id);
    return { transaction: tx };
  },
});

if (import.meta.main) serve(handler);
