import { createDemoApi } from '@/data/demo/demoApi';

/** The demo backend applies the same journal rules as transition_tx, so its balances must behave like the ledger. */
describe('demo API money rules', () => {
  const withdraw = (api: ReturnType<typeof createDemoApi>, key: string, amountDrops = 100_000_000n) =>
    api.requestWithdrawal({
      idempotencyKey: key,
      asset: 'XRP',
      memo: null,
      amountDrops,
      destination: 'rRecipXk3PaKcV9tYwZ2hNproto7Hd',
      destinationTag: '10293847',
    });
  const balances = async (api: ReturnType<typeof createDemoApi>, asset = 'XRP') => {
    const h = (await api.holdings()).find((x) => x.asset === asset);
    if (!h) throw new Error(`no ${asset} holding`);
    return h;
  };

  it('a withdrawal request moves the amount from available to reserved', async () => {
    const api = createDemoApi();
    const before = await balances(api);
    const tx = await withdraw(api, 'k-1');
    const after = await balances(api);
    expect(tx.status).toBe('in_review');
    expect(before.available - after.available).toBe(100_000_000n);
    expect(after.reserved - before.reserved).toBe(100_000_000n);
  });

  it('retrying with the same idempotency key returns the same request and reserves once', async () => {
    const api = createDemoApi();
    const before = await balances(api);
    const [a, b] = await Promise.all([withdraw(api, 'k-2'), withdraw(api, 'k-2')]);
    const after = await balances(api);
    expect(a.id).toBe(b.id);
    expect(before.available - after.available).toBe(100_000_000n);
  });

  it('cancelling releases the hold back to available', async () => {
    const api = createDemoApi();
    const before = await balances(api);
    const tx = await withdraw(api, 'k-3');
    await api.cancelWithdrawal(tx.id);
    const after = await balances(api);
    expect(after.available).toBe(before.available);
    expect(after.reserved).toBe(before.reserved);
  });

  it('a BTC withdrawal checks the Bitcoin address and reserves BTC only', async () => {
    const api = createDemoApi();
    const xrpBefore = await balances(api);
    const btcBefore = await balances(api, 'BTC');
    await expect(
      api.requestWithdrawal({
        idempotencyKey: 'b-0',
        asset: 'BTC',
        memo: null,
        amountDrops: 100_000n,
        destination: 'rRecipXk3PaKcV9tYwZ2hNproto7Hd',
        destinationTag: null,
      }),
    ).rejects.toThrow(/valid Bitcoin address/);
    await api.requestWithdrawal({
      idempotencyKey: 'b-1',
      asset: 'BTC',
      memo: null,
      amountDrops: 100_000n,
      destination: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      destinationTag: null,
    });
    const btcAfter = await balances(api, 'BTC');
    expect(btcBefore.available - btcAfter.available).toBe(100_000n);
    expect(btcAfter.reserved).toBe(100_000n);
    expect((await balances(api)).available).toBe(xrpBefore.available);
  });

  it('a reported deposit is pending until staff confirm it', async () => {
    const api = createDemoApi();
    const tx = await api.reportDeposit({ idempotencyKey: 'd-1', asset: 'ETH', amountUnits: 5_000_000n, txHash: '0xabc123def4567890', from: null });
    expect(tx.status).toBe('reported');
    expect(tx.asset).toBe('ETH');
    await expect(api.reportDeposit({ idempotencyKey: 'd-2', asset: 'ETH', amountUnits: 5_000_000n, txHash: '0xabc123def4567890', from: null })).rejects.toThrow(
      /already been reported/,
    );
  });

  it('every supported asset has deposit info and a registry entry', async () => {
    const api = createDemoApi();
    const assets = await api.assets();
    expect(assets.length).toBe(18);
    const usdt = await api.depositInfo('USDT');
    expect(usdt.mode).toBe('reported');
    expect(usdt.networks.map((n) => n.id)).toEqual(['tron', 'ethereum']);
    const usdtEth = await api.depositInfo('USDT', 'ethereum');
    expect([usdtEth.networkId, usdtEth.network, usdtEth.address.startsWith('0x')]).toEqual(['ethereum', 'Ethereum (ERC-20)', true]);
    expect((await api.depositInfo('XRP')).tag).toBe('48201937');
  });
});
