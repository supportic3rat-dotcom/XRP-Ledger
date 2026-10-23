import { fnSchemas } from '@xrp/schemas';
import type { TxRow } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Staff record a deposit they've seen arrive for a customer. A different staff member approves the credit (SQL enforces it). */
export const handler = defineFunction({
  name: 'deposit-record',
  schema: fnSchemas['deposit-record'],
  access: { kind: 'staff', roles: ['operations', 'compliance'] },
  run: async (ctx) => ({
    transaction: await ctx.rpc<TxRow>(
      'staff_record_deposit',
      { p_customer: ctx.input.customerId, p_asset: ctx.input.asset, p_amount: ctx.input.amountUnits, p_tx_hash: ctx.input.txHash, p_note: ctx.input.note },
      'user',
    ),
  }),
});

if (import.meta.main) serve(handler);
