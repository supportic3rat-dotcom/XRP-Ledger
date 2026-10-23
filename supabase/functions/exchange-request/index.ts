import { unitsToCents } from '@xrp/ledger';
import { fnSchemas } from '@xrp/schemas';
import { currentPriceMicro, customerId, type TxRow } from '../_shared/customer.ts';
import { type Ctx, defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';
import { firmQuote } from '../_shared/quotes.ts';

/**
 * Exchange any asset for USD, or swap it into another asset (manual). A new request is recorded for Operations to review; nothing is reserved.
 * `requote` asks the liquidity provider for a fresh firm quote after the previous one expired.
 */
export const handler = defineFunction({
  name: 'exchange-request',
  schema: fnSchemas['exchange-request'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const me = customerId(ctx);
    if (ctx.input.requote) {
      const { data } = await ctx.db.from('transactions').select('*').match({ id: ctx.input.requote, customer_id: me, kind: 'exchange' }).single();
      const tx = data as TxRow | null;
      if (!tx) throw new HttpError(404, 'Exchange not found', 'not_found');
      if (tx.status !== 'quote_expired') throw new HttpError(400, 'This request already has a live quote.', 'rejected');
      await ctx.rpc('transition_tx', { p_tx: tx.id, p_to: 'quote_requested', p_actor: 'Customer', p_note: 'New quote requested' });
      return { transaction: tx, quote: await firmQuote(ctx, tx.id, BigInt(String(tx.amount_drops)), tx.asset, tx.counter_asset) };
    }
    const { asset, toAsset } = ctx.input;
    const amount = BigInt(ctx.input.amountDrops);
    const indicative = unitsToCents(amount, await currentPriceMicro(ctx, asset), asset);
    return { transaction: await existingOrNew(ctx, me, amount, indicative, asset, toAsset ?? null) };
  },
});

/** A retry with the same Idempotency-Key returns the original request instead of creating a second one. */
const existingOrNew = async (ctx: Ctx<unknown>, me: string, amount: bigint, indicativeCents: bigint, asset: string, toAsset: string | null): Promise<TxRow> => {
  const key = ctx.idempotencyKey;
  if (key) {
    const { data } = await ctx.db.from('transactions').select('*').match({ customer_id: me, idempotency_key: key }).maybeSingle();
    if (data) return data as TxRow;
  }
  return ctx.rpc<TxRow>('request_exchange', {
    p_customer: me,
    p_amount_drops: amount.toString(),
    p_indicative_cents: indicativeCents.toString(),
    p_idempotency_key: key,
    p_asset: asset,
    p_to_asset: toAsset,
  });
};

if (import.meta.main) serve(handler);
