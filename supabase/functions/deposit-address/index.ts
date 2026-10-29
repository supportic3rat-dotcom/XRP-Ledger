import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

/**
 * Where to send an asset, on the network asked for (or its default), with the asset's other networks for a picker.
 * XRP: the shared hot wallet plus this customer's destination tag (credited automatically). Other assets: the
 * platform address for that network; the customer reports the deposit afterwards.
 * Verified customers only (verify first).
 */
export const handler = defineFunction({
  name: 'deposit-address',
  schema: fnSchemas['deposit-address'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const { data: customer } = await ctx.db.from('customers').select('destination_tag, kyc_status, frozen_at').eq('id', customerId(ctx)).single();
    const c = customer as { destination_tag: number; kyc_status: string; frozen_at: string | null } | null;
    if (!c) throw new HttpError(404, 'Customer not found', 'not_found');
    if (c.frozen_at) throw new HttpError(403, 'Your account is frozen. Contact support.', 'frozen');
    const [{ data: row }, { data: nets }] = await Promise.all([
      ctx.db.from('assets').select('id, deposit_mode, deposit_memo, min_deposit, enabled').eq('id', ctx.input.asset).single(),
      ctx.db.from('asset_networks').select('network, name, memo_kind, deposit_address').eq('asset', ctx.input.asset).order('sort'),
    ]);
    const a = row as { id: string; deposit_mode: 'automatic' | 'reported'; deposit_memo: string | null; min_deposit: number | string; enabled: boolean } | null;
    const networks = (nets ?? []) as { network: string; name: string; memo_kind: 'tag' | 'memo' | null; deposit_address: string | null }[];
    if (!a || !a.enabled || !networks.length) throw new HttpError(400, `${ctx.input.asset} isn’t available right now.`, 'rejected');
    const n = networks.find((x) => x.network === ctx.input.network) ?? networks[0]!;
    const list = networks.map((x) => ({ id: x.network, name: x.name, open: a.deposit_mode === 'automatic' || !!x.deposit_address }));
    const testnet = Deno.env.get('XRPL_NETWORK') === 'testnet';
    if (a.deposit_mode === 'automatic') {
      const { data: wallet } = await ctx.db.from('custody_wallets').select('address').eq('tier', 'hot').limit(1).single();
      return {
        asset: a.id,
        mode: 'automatic',
        address: (wallet as { address: string } | null)?.address ?? '',
        tag: String(c.destination_tag),
        memo: null,
        network: n.name,
        networkId: n.network,
        networks: list,
        testnet,
        minDrops: String(a.min_deposit),
      };
    }
    return {
      asset: a.id,
      mode: 'reported',
      address: n.deposit_address ?? '',
      // Shared addresses with tags (XRP): the customer's own tag is how staff match the deposit to them.
      tag: n.memo_kind === 'tag' ? String(c.destination_tag) : null,
      // Memo networks get the platform memo, or else the customer's reference so staff can match it faster.
      memo: n.memo_kind === 'memo' ? (a.deposit_memo ?? String(c.destination_tag)) : null,
      network: n.name,
      networkId: n.network,
      networks: list,
      testnet: false,
      minDrops: String(a.min_deposit),
    };
  },
});

if (import.meta.main) serve(handler);
