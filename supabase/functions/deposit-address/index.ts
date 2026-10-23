import { asset as assetSpec } from '@xrp/ledger';
import { fnSchemas } from '@xrp/schemas';
import { customerId } from '../_shared/customer.ts';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

/**
 * Where to send an asset. XRP: the shared omnibus address plus this customer's destination tag (credited
 * automatically). Other assets: the address staff configured; the customer reports the deposit afterwards.
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
    if (c.kyc_status !== 'verified') throw new HttpError(403, 'Verify your identity to continue.', 'kyc_required');
    if (c.frozen_at) throw new HttpError(403, 'Your account is frozen. Contact support.', 'frozen');
    const { data: row } = await ctx.db
      .from('assets')
      .select('id, network, deposit_mode, deposit_address, deposit_memo, min_deposit, memo_kind, enabled')
      .eq('id', ctx.input.asset)
      .single();
    const a = row as {
      id: string;
      network: string;
      deposit_mode: 'automatic' | 'reported';
      deposit_address: string | null;
      deposit_memo: string | null;
      min_deposit: number | string;
      memo_kind: 'tag' | 'memo' | null;
      enabled: boolean;
    } | null;
    if (!a || !a.enabled) throw new HttpError(400, `${ctx.input.asset} isn’t available right now.`, 'rejected');
    const testnet = (Deno.env.get('XRPL_NETWORK') ?? 'testnet') !== 'mainnet';
    if (a.deposit_mode === 'automatic') {
      const { data: wallet } = await ctx.db.from('custody_wallets').select('address').eq('tier', 'hot').limit(1).single();
      return {
        asset: a.id,
        mode: 'automatic',
        address: (wallet as { address: string } | null)?.address ?? '',
        tag: String(c.destination_tag),
        memo: null,
        network: a.network,
        testnet,
        minDrops: String(a.min_deposit),
      };
    }
    return {
      asset: a.id,
      mode: 'reported',
      address: a.deposit_address ?? '',
      tag: null,
      // Memo networks get the platform memo, or else the customer's reference so staff can match it faster.
      memo: a.memo_kind === 'memo' ? (a.deposit_memo ?? String(c.destination_tag)) : null,
      network: assetSpec(a.id).network,
      testnet: false,
      minDrops: String(a.min_deposit),
    };
  },
});

if (import.meta.main) serve(handler);
