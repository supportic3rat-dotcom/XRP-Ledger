import { exchangeEstimateFor, swapEstimate, unitsToCents } from '@xrp/ledger';
import type { Ctx } from './handler.ts';

export type QuoteRow = { id: string; price_micro: number; fee_cents: number; receive_cents: number; receive_units: number | null; expires_at: string };

/**
 * Gets a firm quote from the liquidity provider and records it (status → quoted). A sale for USD shows the 1% spread
 * plus the payout fee; a swap takes the spread from the asset received and records the units the customer gets.
 */
export const firmQuote = async (
  ctx: Ctx<unknown>,
  transactionId: string,
  amount: bigint,
  asset = 'XRP',
  toAsset: string | null = null,
): Promise<QuoteRow> => {
  const q = await ctx.providers.liquidity.requestQuote({ amountDrops: amount, asset, toAsset });
  if (toAsset) {
    if (!q.toPriceMicro) throw new Error('The liquidity provider returned no price for the swap.');
    const s = swapEstimate(amount, { asset, price: q.priceMicro }, { asset: toAsset, price: q.toPriceMicro });
    return ctx.rpc<QuoteRow>('record_quote', {
      p_tx: transactionId,
      p_price_micro: q.priceMicro.toString(),
      p_fee_cents: unitsToCents(s.fee, q.toPriceMicro, toAsset).toString(),
      p_receive_cents: unitsToCents(s.receive, q.toPriceMicro, toAsset).toString(),
      p_expires_at: q.expiresAt,
      p_receive_units: s.receive.toString(),
    });
  }
  const e = exchangeEstimateFor(asset, amount, q.priceMicro);
  const fee = e.fee + e.payout;
  return ctx.rpc<QuoteRow>('record_quote', {
    p_tx: transactionId,
    p_price_micro: q.priceMicro.toString(),
    p_fee_cents: fee.toString(),
    p_receive_cents: (e.gross - fee).toString(),
    p_expires_at: q.expiresAt,
  });
};
