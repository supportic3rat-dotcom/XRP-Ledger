import { ASSET_IDS } from '@xrp/ledger';
import type { CoinGecko, PriceFeed } from '@xrp/providers';
import type { Chain } from './chain.ts';
import type { Store } from './store.ts';

/** On-ledger balances for reconciliation, and read-only balances of customers' linked outside wallets. */
export const refreshBalances = async (deps: { chain: Chain; store: Store }, wallets: { address: string }[], ledgerIndex: number) => {
  for (const w of wallets) await deps.store.setChainBalance(w.address, await deps.chain.balance(w.address), ledgerIndex);
  for (const w of await deps.store.externalWallets()) await deps.store.setExternalBalance(w.id, await deps.chain.balance(w.address));
};

/** Latest price with its 24-hour change in basis points (integer maths, half away from zero). */
export const recordPrice = async (feed: PriceFeed, store: Store, asset = 'XRP') => {
  const [now, day] = await Promise.all([feed.getPrice(asset), feed.getHistory(asset, '1D')]);
  const open = day[0]?.priceMicro ?? now.priceMicro;
  const diff = (now.priceMicro - open) * 10_000n;
  const bps = open === 0n ? 0n : (diff + (diff >= 0n ? open / 2n : -open / 2n)) / open;
  await store.insertPrice(asset, now.priceMicro, Number(bps), now.source);
};

/** Every supported asset's price and 24-hour change from CoinGecko, in one request. */
export const recordAllPrices = async (cg: CoinGecko, store: Store) => {
  for (const p of await cg.prices(ASSET_IDS)) await store.insertPrice(p.asset, p.priceMicro, p.changeBps, 'Market data');
};
