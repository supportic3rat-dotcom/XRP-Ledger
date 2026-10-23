import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

/** Compliance sets the address customers send an asset to (validated against its network), or closes deposits. Audited in SQL. */
export const handler = defineFunction({
  name: 'asset-update',
  schema: fnSchemas['asset-update'],
  access: { kind: 'staff', roles: ['compliance'] },
  run: async (ctx) =>
    ctx.rpc(
      'asset_set_deposit_address',
      { p_asset: ctx.input.asset, p_address: ctx.input.depositAddress, p_memo: ctx.input.memo, p_enabled: ctx.input.enabled },
      'user',
    ),
});

if (import.meta.main) serve(handler);
