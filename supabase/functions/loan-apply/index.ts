import { fnSchemas } from '@xrp/schemas';
import { currentPriceMicro, customerId, type TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Loan application. LTV is checked in SQL against the current price (≤ 50% to start). Compliance approves it (the
 * collateral locks at once), then staff pay it by bank transfer to the account given.
 */
export const handler = defineFunction({
  name: 'loan-apply',
  schema: fnSchemas['loan-apply'],
  access: { kind: 'customer' },
  idempotent: true,
  run: async (ctx) => ({
    transaction: await ctx.rpc<TxRow>('loan_apply', {
      p_customer: customerId(ctx),
      p_collateral_drops: ctx.input.collateralDrops,
      p_principal_cents: ctx.input.principalCents,
      p_price_micro: (await currentPriceMicro(ctx, ctx.input.asset)).toString(),
      p_agreement_version: ctx.input.agreementVersion,
      p_idempotency_key: ctx.idempotencyKey,
      p_asset: ctx.input.asset,
      p_payout: { bank: ctx.input.payout.bank, account_number: ctx.input.payout.accountNumber, account_name: ctx.input.payout.accountName },
    }),
  }),
});

if (import.meta.main) serve(handler);
