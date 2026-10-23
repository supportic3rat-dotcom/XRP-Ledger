import { assetsFrom, historySeries, portfolioOf } from '../markets';
import { formatUnits, usdOf } from '../money';
import { PERIODS, syntheticSeries } from '../series';
import type { Asset, DashboardSource, PeriodId, Snapshot, Tx } from './types';

/**
 * Demo mode (no Supabase project connected): the design's sample account, so every screen and state can be
 * reviewed. Nothing here moves money; requests are recorded locally for the session.
 */

/** The design's clock: Oct 19, 2026, 12:50 WAT. */
export const DEMO_NOW = new Date('2026-10-19T11:50:00Z');

/** The demo account's holdings (base units at each asset's ledger precision); prices are live. */
const HOLDINGS: Record<string, bigint> = { XRP: 6_420_100_000n, BTC: 7_210_000n, ETH: 61_420_000n };

const TXS: Tx[] = [
  {
    id: 't1',
    kind: 'receive',
    asset: 'XRP',
    title: 'Received XRP',
    date: 'Today, 11:42',
    amount: '+1,250.00 XRP',
    fiat: '$2,975.00',
    status: 'pending',
    party: 'rSender…prototype',
    fee: 'None',
    ref: 'DEP-PROTO-2041',
    ledger: null,
  },
  {
    id: 't2',
    kind: 'send',
    asset: 'XRP',
    title: 'Sent XRP',
    date: 'Oct 17, 16:08',
    amount: '−300.00 XRP',
    fiat: '$714.00',
    status: 'completed',
    party: 'rRecipient…prototype',
    fee: '0.25 XRP',
    ref: 'WD-PROTO-1988',
    ledger: '92,301,447',
  },
  {
    id: 't3',
    kind: 'receive',
    asset: 'BTC',
    title: 'Received Bitcoin',
    date: 'Oct 15, 09:21',
    amount: '+0.01500 BTC',
    fiat: '$1,470.00',
    status: 'completed',
    party: 'bc1q…prototype',
    fee: 'None',
    ref: 'DEP-PROTO-1954',
    ledger: null,
  },
  {
    id: 't4',
    kind: 'exchange',
    asset: 'XRP',
    title: 'Exchanged ETH for XRP',
    date: 'Oct 12, 14:55',
    amount: '+319.44 XRP',
    secondary: '−0.2000 ETH',
    fiat: '$760.27',
    status: 'completed',
    party: 'Internal exchange',
    fee: '$1.52',
    ref: 'EX-PROTO-1903',
    ledger: null,
  },
  {
    id: 't5',
    kind: 'send',
    asset: 'BTC',
    title: 'Sent Bitcoin',
    date: 'Oct 8, 18:30',
    amount: '−0.00500 BTC',
    fiat: '$490.00',
    status: 'failed',
    party: 'bc1q…prototype',
    fee: 'Refunded',
    ref: 'WD-PROTO-1871',
    ledger: null,
  },
  {
    id: 't6',
    kind: 'buy',
    asset: 'XRP',
    title: 'Bought XRP',
    date: 'Sep 28, 10:02',
    amount: '+500.00 XRP',
    fiat: '$1,190.00',
    status: 'completed',
    party: '[Payment method]',
    fee: '$4.76',
    ref: 'BUY-PROTO-1790',
    ledger: null,
  },
  {
    id: 't7',
    kind: 'receive',
    asset: 'ETH',
    title: 'Received Ethereum',
    date: 'Sep 21, 08:47',
    amount: '+0.2500 ETH',
    fiat: '$950.33',
    status: 'completed',
    party: '0x…prototype',
    fee: 'None',
    ref: 'DEP-PROTO-1722',
    ledger: null,
  },
];

const SNAPSHOT: Omit<Snapshot, 'assets' | 'portfolioCents' | 'portfolioChangeCents'> = {
  displayName: 'Brendan M.',
  initials: 'BM',
  email: 'brendan@example.com',
  verified: true,
  displayCurrency: 'USD',
  allTimeSuffix: PERIODS.ALL.suffix,
  txs: TXS,
  notices: [
    { id: 'n1', text: 'Deposit of 1,250.00 XRP is waiting for network confirmation.', time: 'Today, 11:42', tone: 'warn' },
    { id: 'n2', text: 'New sign-in from Chrome on macOS.', time: 'Today, 09:14', tone: 'accent' },
  ],
  security: { twofa: true, allowlist: false, allowlistCount: 2, lastSignIn: 'Today, 09:14 · Chrome on macOS', passwordChanged: 'Last changed 3 months ago' },
  notifications: { receipts: true, alerts: false },
};

const ok = <T>(value: T, message?: string) => ({ ok: true as const, value, ...(message ? { message } : {}) });

export const createDemoSource = (): DashboardSource => {
  let wd = 2042;
  let assets: Asset[] = [];
  // The chart can be asked for before load() finishes; it waits for the same holdings.
  let loading: Promise<Asset[]> | null = null;
  const ready = async () => (assets.length ? assets : (loading ??= assetsFrom(HOLDINGS, false).then((r) => (assets = r.assets))));
  const find = (id: string) => assets.find((x) => x.id === id) ?? assets[0]!;
  return {
    mode: 'demo',
    needsTotp: false,
    feesDeducted: false,
    canBuy: true,
    load: async () => {
      loading = assetsFrom(HOLDINGS, false).then((r) => (assets = r.assets));
      await loading;
      const pf = portfolioOf(assets);
      return { ...structuredClone(SNAPSHOT), assets, portfolioCents: pf.cents, portfolioChangeCents: pf.change };
    },
    series: async (assetId, period) => {
      await ready();
      try {
        const pts = await historySeries(assetId ?? assets.map((a) => ({ id: a.id, units: a.units, scale: a.scale })), period);
        if (pts.length > 1) return pts;
      } catch {
        /* illustrative series below */
      }
      const p = PERIODS[period];
      if (!assetId) {
        const pf = portfolioOf(assets);
        return syntheticSeries(period, new Date(), Number(pf.cents) / 100, Number(pf.change[period]) / 100, p.vol, 101 + p.n);
      }
      const a = find(assetId);
      const price = Number(a.priceMicro) / 1e6;
      return syntheticSeries(period, new Date(), price, (price * a.periodChangeBps[period]) / 10_000, p.vol * 1.6, a.id.charCodeAt(0) * 7 + p.n);
    },
    deposit: async (assetId) => ({
      address:
        (
          {
            XRP: 'rP9prototype0not0a0real0address',
            BTC: 'bc1qdemo0address0do0not0send0funds0xyz9k',
            ETH: '0xDe00000000000000000000000000000000000001',
            USDT: 'TDemoAddressDoNotSendFundsXyz12345',
          } as Record<string, string>
        )[assetId] ?? '',
      tag: assetId === 'XRP' ? '48201937' : null,
      network: find(assetId).network,
      real: false,
      mode: assetId === 'XRP' ? 'automatic' : 'reported',
      open: ['XRP', 'BTC', 'ETH', 'USDT'].includes(assetId),
    }),
    withdraw: async (input) => {
      const ref = `WD-PROTO-${wd++}`;
      const a = find(input.assetId);
      const short = input.destination.length > 16 ? `${input.destination.slice(0, 8)}…${input.destination.slice(-6)}` : input.destination;
      return ok({
        ref,
        tx: {
          id: `wd${wd}`,
          kind: 'send',
          asset: a.id,
          title: `Withdrawal request · ${a.ticker}`,
          date: 'Today, 12:52',
          amount: `−${formatUnits(input.units, a.scale, a.decimals)} ${a.ticker}`,
          fiat: usdOf(input.units, a.scale, a.priceMicro),
          status: 'review',
          party: short,
          fee: `${formatUnits(a.feeUnits, a.scale, a.decimals)} ${a.ticker}`,
          ref,
          ledger: null,
        },
      });
    },
    setSecurity: async () => ok(undefined),
    setNotification: async () => ok(undefined),
    markRead: async () => undefined,
    signOut: async () => ({ ok: false, error: 'Demo mode: there is no account to sign out of.' }),
    contactSupport: async () => ({ ok: false, error: 'Demo mode: support messages aren’t sent.' }),
    changePassword: async () => ({ ok: false, error: 'Demo mode: there is no password to change.' }),
  };
};
