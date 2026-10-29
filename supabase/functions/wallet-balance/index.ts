import { isNetworkAddress } from '@xrp/ledger';
import { fnSchemas } from '@xrp/schemas';
import { chainBalances } from '../_shared/chains.ts';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

/** Balances of any address on a supported network. Public: it only relays public ledger data, nothing personal. */
export const handler = defineFunction({
  name: 'wallet-balance',
  schema: fnSchemas['wallet-balance'],
  access: { kind: 'public' },
  run: async (ctx) => {
    const { network, address } = ctx.input;
    if (!isNetworkAddress(network, address)) throw new HttpError(400, 'That isn’t a valid address on this network.', 'invalid');
    const balances = await chainBalances(network, address.trim()).catch(() => {
      throw new HttpError(503, 'That network can’t be read right now. Try again in a minute.', 'unavailable');
    });
    return { balances: Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, v.toString()])) };
  },
});

if (import.meta.main) serve(handler);
