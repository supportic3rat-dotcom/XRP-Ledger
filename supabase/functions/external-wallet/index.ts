import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Links an outside wallet by address. Watch-only and self-custody wallets are read from the public ledger;
 * a self-custody key never leaves the device, so only the address is stored here.
 */
export const handler = defineFunction({
  name: 'external-wallet',
  schema: fnSchemas['external-wallet'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const input = ctx.input;
    await ctx.rpc('external_wallet_set', {
      p_customer: customerId(ctx),
      p_address: input.address,
      p_access: input.action === 'add' ? input.access : 'watch',
      p_add: input.action === 'add',
    });
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
