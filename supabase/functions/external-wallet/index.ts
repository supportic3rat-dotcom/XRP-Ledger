import { fnSchemas } from '@xrp/schemas';
import { chainBalances } from '../_shared/chains.ts';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Links an outside wallet by address, on any supported network. Watch-only wallets are read from public data;
 * a self-custody key never leaves the phone, so only the address is stored here. The balance is read at once.
 */
export const handler = defineFunction({
  name: 'external-wallet',
  schema: fnSchemas['external-wallet'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const input = ctx.input;
    const me = customerId(ctx);
    const address = input.address.trim();
    await ctx.rpc('external_wallet_set', {
      p_customer: me,
      p_address: address,
      p_access: input.action === 'add' ? input.access : 'watch',
      p_add: input.action === 'add',
      p_network: input.network,
    });
    if (input.action === 'add') {
      const balances = await chainBalances(input.network, address).catch(() => null);
      if (balances) {
        await ctx.db
          .from('external_wallets')
          .update({
            balances: Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, v.toString()])),
            ...(input.network === 'xrp' ? { balance_drops: (balances.XRP ?? 0n).toString() } : {}),
            balance_at: new Date().toISOString(),
          })
          .match({ customer_id: me, network: input.network, address })
          .is('removed_at', null);
      }
    }
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
