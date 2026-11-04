import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { centsIn, formatFiat, formatFiatCompact, formatFiatPrice, formatUsd } from '@xrp/ledger';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { api } from './index';
import { describeTx, type TxView } from './describeTx';
import { qk } from './keys';
import { subscribeDemo } from './demo/demoApi';
import { supabase } from './supabaseApi';
import type { Cents, MicroUsd, Transaction, YieldPosition } from '@xrp/types';
import type { Holding, PriceInfo } from './api';
import { useMarkets, usePriceMap, type BalanceFlow } from './market';
import { useSession } from '@/state/session';

export const useProfile = () => useQuery({ queryKey: qk.profile, queryFn: api.profile });
/** Kept for 50 minutes: the signed URL lasts an hour. */
export const useProfilePhoto = (enabled: boolean) => useQuery({ queryKey: qk.profilePhoto, queryFn: api.profilePhoto, enabled, staleTime: 50 * 60_000 });
/** The customer's crypto trust (null until created). */
export const useTrust = () => {
  const signedIn = useSession((s) => s.signedIn);
  return useQuery({ queryKey: qk.trust, queryFn: api.trust, enabled: signedIn });
};
export const useAssets = () => useQuery({ queryKey: qk.assets, queryFn: api.assets, staleTime: 5 * 60_000 });
export const useHoldings = () => useQuery({ queryKey: qk.holdings, queryFn: api.holdings });
const zero = (asset: string): Holding => ({ asset, available: 0n, reserved: 0n, pendingYield: 0n, yield: 0n, collateral: 0n });
/** One asset's balances (zeros when the customer has never held it). */
export const useBalances = (asset = 'XRP') =>
  useQuery({ queryKey: qk.holdings, queryFn: api.holdings, select: (h: Holding[]) => h.find((x) => x.asset === asset) ?? zero(asset) });
/** Live USD price of an asset, shaped like the old single-asset price feed. `stale` when only sample prices are available. */
export const usePrice = (asset = 'XRP') => {
  const m = useMarkets();
  const row = m.data?.find((r) => r.asset === asset);
  const data: PriceInfo | undefined = row
    ? { priceMicro: row.priceMicro, changeBps: row.changeBps, at: row.updatedAt, source: row.live ? 'live prices' : 'sample prices', stale: !row.live }
    : undefined;
  return { ...m, data };
};
export const useNotifications = () => useQuery({ queryKey: qk.notifications, queryFn: api.notifications });
export const useDepositInfo = (asset = 'XRP', network?: string) =>
  useQuery({ queryKey: qk.deposit(asset, network), queryFn: () => api.depositInfo(asset, network), staleTime: 60_000 });
export const useLoan = () => useQuery({ queryKey: qk.loan, queryFn: api.loan });
export const useYieldPositions = () => useQuery({ queryKey: qk.yield, queryFn: api.yieldPositions });
export const useYield = (asset = 'XRP') =>
  useQuery({ queryKey: qk.yield, queryFn: api.yieldPositions, select: (ps: YieldPosition[]) => ps.find((p) => p.asset === asset) ?? null });
export const useAllowlist = () => useQuery({ queryKey: qk.allowlist, queryFn: api.allowlist });
export const useDevices = () => useQuery({ queryKey: qk.devices, queryFn: api.devices });
export const useSecurityEvents = () => useQuery({ queryKey: qk.securityEvents, queryFn: api.securityEvents });
export const useTickets = (enabled = true) => useQuery({ queryKey: qk.tickets, queryFn: api.tickets, enabled });
export const useLegalDocuments = () => useQuery({ queryKey: qk.legal, queryFn: api.legalDocuments, staleTime: Infinity });
export const useConsents = (enabled = true) => useQuery({ queryKey: qk.consents, queryFn: api.consents, enabled });
export const useExternalWallets = () => useQuery({ queryKey: qk.externalWallets, queryFn: api.externalWallets });
export const useCustodyStatus = () => useQuery({ queryKey: qk.custody, queryFn: api.custodyStatus });
export const useKycStatus = () => useQuery({ queryKey: qk.kyc, queryFn: api.kycStatus });
/** The newest identity decision sent to the customer, with Compliance's reason. */
export const useKycDecision = () => useNotifications().data?.find((n) => n.link === '/verify') ?? null;
export const useQuote = (txId: string | null) => useQuery({ queryKey: qk.quote(txId ?? ''), queryFn: () => api.currentQuote(txId ?? ''), enabled: !!txId });

/** When the transaction occurred for lists: settlement time for settled withdrawals, loans and rewards; creation time otherwise. */
export const occurredAt = (t: Transaction): string => {
  const at = (s: string) => t.events.find((e) => e.toStatus === s)?.at;
  if (t.kind === 'withdrawal' && t.status === 'validated') return at('validated') ?? t.createdAt;
  if (t.kind === 'loan') return at('funded') ?? t.createdAt;
  if (t.kind === 'yield_reward' && t.status === 'credited') return at('credited') ?? t.createdAt;
  return t.createdAt;
};

/** Settled balance changes for the Home chart: credited deposits and rewards, sent withdrawals, completed swaps. */
export const balanceFlows = (txs: Transaction[]): BalanceFlow[] =>
  txs.flatMap((t): BalanceFlow[] => {
    const units = t.amountDrops ?? 0n;
    const at = (s: string) => t.events.find((e) => e.toStatus === s)?.at ?? t.createdAt;
    if ((t.kind === 'deposit' || t.kind === 'yield_reward') && t.status === 'credited') return [{ asset: t.asset, units: units < 0n ? -units : units, at: at('credited') }];
    if (t.kind === 'withdrawal' && t.status === 'validated') return [{ asset: t.asset, units: units > 0n ? -units : units, at: at('validated') }];
    if (t.kind === 'exchange' && (t.status === 'sold' || t.status === 'paid_out')) {
      const when = at('sold');
      const out: BalanceFlow = { asset: t.asset, units: units > 0n ? -units : units, at: when };
      return t.counterAsset && t.counterAmount ? [out, { asset: t.counterAsset, units: t.counterAmount, at: when }] : [out];
    }
    return [];
  });

/**
 * Formats values in the customer's own currency (set from their country; changeable in Profile). Money is always
 * USD underneath: this converts only for showing. Until a rate is known, values show in USD.
 */
export const useMoney = () => {
  const profile = useProfile();
  const wanted = profile.data?.currency ?? 'USD';
  const rate = useQuery({ queryKey: qk.fx(wanted), queryFn: () => api.fxRate(wanted), staleTime: 60 * 60_000, enabled: wanted !== 'USD' });
  const known = wanted === 'USD' ? 1 : (rate.data ?? null);
  const code = known === null ? 'USD' : wanted;
  const r = known ?? 1;
  return useMemo(
    () => ({
      /** ISO code values are shown in (USD until a rate loads). */
      code,
      /** A USD amount (cents) as the customer's currency: "£1,234.56". */
      money: (cents: Cents): string => (code === 'USD' ? formatUsd(cents) : formatFiat(centsIn(cents, r), code)),
      /** A coin price (micro-USD per coin). */
      price: (micro: MicroUsd): string => formatFiatPrice(micro, code, r),
      /** A large USD figure (market cap, volume): "£2.3T". */
      compact: (usd: number): string => formatFiatCompact(usd * r, code),
      /** The customer-currency equivalent of a USD amount, for USD-denominated items: "≈ £1,560.00", or '' in USD. */
      equivalent: (cents: Cents): string => (code === 'USD' ? '' : `≈ ${formatFiat(centsIn(cents, r), code)}`),
    }),
    [code, r],
  );
};
export type Money = ReturnType<typeof useMoney>;

/** Customer-facing activity: newest first, described for the list and the detail sheet. */
export const useActivity = () => {
  const signedIn = useSession((s) => s.signedIn);
  const txs = useQuery({ queryKey: qk.activity, queryFn: api.transactions, enabled: signedIn });
  const { prices } = usePriceMap();
  const wallets = useExternalWallets();
  const m = useMoney();
  const views = useMemo<TxView[]>(() => {
    if (!txs.data) return [];
    const ctx = { now: api.now(), prices, connectedWallets: (wallets.data ?? []).map((w) => w.address), money: m.money, price: m.price };
    return txs.data
      .filter((t) => ['deposit', 'withdrawal', 'exchange', 'yield_reward', 'loan'].includes(t.kind))
      .map((t) => ({ ...t, createdAt: occurredAt(t) }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((t) => describeTx(t, ctx));
  }, [txs.data, prices, wallets.data, m]);
  return { ...txs, views, raw: txs.data ?? [] };
};

/** Each mounted app layout gets its own channel: Supabase reuses a channel by name and throws on a second subscribe. */
let liveChannels = 0;

/** Live updates: Supabase Realtime on transactions/notifications, or the demo backend's change feed. Invalidates queries. */
export const useLiveUpdates = () => {
  const qc = useQueryClient();
  useEffect(() => {
    if (api.mode === 'demo') return subscribeDemo(() => qc.invalidateQueries());
    // Realtime misses anything that happens while the app is in the background.
    const onForeground = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      for (const queryKey of [qk.notifications, qk.profile, qk.kyc]) qc.invalidateQueries({ queryKey });
    });
    const channel = supabase()
      .channel(`customer-live-${++liveChannels}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        qc.invalidateQueries({ queryKey: qk.activity });
        qc.invalidateQueries({ queryKey: qk.holdings });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_events' }, () => qc.invalidateQueries({ queryKey: qk.activity }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        qc.invalidateQueries({ queryKey: qk.notifications });
        qc.invalidateQueries({ queryKey: qk.profile });
        qc.invalidateQueries({ queryKey: qk.kyc });
      })
      .subscribe();
    return () => {
      onForeground.remove();
      supabase()
        .removeChannel(channel)
        .catch(() => undefined);
    };
  }, [qc]);
};

export const useSignOut = () => {
  const qc = useQueryClient();
  const router = useRouter();
  const setSignedIn = useSession((s) => s.setSignedIn);
  return async () => {
    await api.signOut().catch(() => undefined);
    qc.clear();
    setSignedIn(false);
    router.replace('/welcome');
  };
};

/** Mutation helper: runs an API write and refreshes everything it may have touched. */
/** Email receipts and price alerts (Profile → Notifications). */
export const useNotificationPrefs = () => {
  const signedIn = useSession((x) => x.signedIn);
  return useQuery({ queryKey: qk.notificationPrefs, queryFn: api.notificationPrefs, enabled: signedIn });
};

export const useApiMutation = <TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
};

export { useMarket, useMarkets, usePriceHistory, usePriceMap, usePortfolioHistory, type BalanceFlow } from './market';
