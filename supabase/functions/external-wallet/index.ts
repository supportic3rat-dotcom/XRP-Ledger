import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';
import { xrpBalance } from '../_shared/xrpl.ts';

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
    // Show the real balance straight away rather than at the next ledger check.
    if (input.action === 'add') {
      const drops = await xrpBalance(input.address).catch(() => null);
      if (drops !== null) {
        await ctx.db.from('external_wallets').update({ balance_drops: drops, balance_at: new Date().toISOString() })
          .match({ customer_id: customerId(ctx), address: input.address }).is('removed_at', null);
      }
    }
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
