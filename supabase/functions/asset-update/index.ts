import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

/**
 * Compliance sets the addresses customers send an asset to (each validated against its network), or closes deposits.
 * The default network goes through the asset setter; the asset's other networks are set one by one. Audited in SQL.
 */
export const handler = defineFunction({
  name: 'asset-update',
  schema: fnSchemas['asset-update'],
  access: { kind: 'staff', roles: ['compliance'] },
  run: async (ctx) => {
    const { asset, depositAddress, memo, enabled, networks = {} } = ctx.input;
    const row = await ctx.rpc('asset_set_deposit_address', { p_asset: asset, p_address: depositAddress, p_memo: memo, p_enabled: enabled }, 'user');
    for (const [network, address] of Object.entries(networks)) {
      await ctx.rpc('asset_set_network_address', { p_asset: asset, p_network: network, p_address: address }, 'user');
    }
    return row;
  },
});

if (import.meta.main) serve(handler);
