import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { asset as assetSpec, formatAmount, formatUsd } from '@xrp/ledger';
import { listDate, monthYear } from '../dates';
import { centsOf } from '../money';
import { assetsFrom, historySeries, portfolioOf } from '../markets';
import type { Asset, DashboardSource, Snapshot, Tx, TxStatus } from './types';

type Row = Record<string, unknown>;
const big = (v: unknown): bigint => (v === null || v === undefined ? 0n : BigInt(String(v)));
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const ok = <T>(value: T, message?: string) => ({ ok: true as const, value, ...(message ? { message } : {}) });
const fail = (error: string) => ({ ok: false as const, error });

const STATUS: Record<string, TxStatus> = {
  credited: 'completed',
  validated: 'completed',
  paid_out: 'completed',
  confirmed: 'completed',
  applied: 'completed',
  lock_confirmed: 'completed',
  active: 'completed',
  funded: 'completed',
  repaid: 'completed',
  requested: 'review',
  in_review: 'review',
  approved: 'review',
  quote_requested: 'review',
  quoted: 'review',
  recorded: 'review',
  sent: 'pending',
  received: 'pending',
  submitted: 'pending',
  detected: 'pending',
  reported: 'review',
  rejected: 'failed',
  failed: 'failed',
  cancelled: 'failed',
  provider_failed: 'failed',
  quote_expired: 'failed',
};

const toTx = (r: Row, prices: Record<string, bigint>, now: Date): Tx => {
  const kind = str(r.kind);
  const status = str(r.status);
  const asset = str(r.asset) || 'XRP';
  const name = assetSpec(asset).name;
  const drops = big(r.amount_drops);
  const xrp = formatAmount(drops, asset);
  const fiat =
    r.amount_cents !== null && (kind === 'loan' || kind === 'loan_repay')
      ? formatUsd(big(r.amount_cents))
      : formatUsd(centsOf(drops, assetSpec(asset).decimals, prices[asset] ?? 0n));
  const base = {
    id: str(r.id),
    asset,
    date: listDate(new Date(str(r.created_at)), now),
    fiat,
    ref: str(r.ref),
    ledger: r.ledger_index ? Number(r.ledger_index).toLocaleString('en-US') : null,
  };
  // A loan in `applied` is an application under review; a repayment in `applied` is done.
  const st: TxStatus =
    kind === 'loan' && status === 'applied' ? 'review' : kind === 'deposit' && status === 'no_tag' ? 'review' : (STATUS[status] ?? 'pending');
  switch (kind) {
    case 'deposit':
      return { ...base, kind: 'receive', title: `Received ${name}`, amount: `+${xrp}`, status: st, party: str(r.counterparty), fee: 'None' };
    case 'withdrawal':
      return {
        ...base,
        kind: 'send',
        title: `Sent ${name}`,
        amount: `−${xrp}`,
        status: st,
        party: str(r.counterparty),
        fee: formatAmount(big(r.fee_drops) + big(r.network_fee_drops), asset, { minDecimals: 2, maxDecimals: 8 }),
      };
    case 'exchange':
      return {
        ...base,
        kind: 'exchange',
        title: r.counter_asset ? `Swapped ${asset} for ${str(r.counter_asset)}` : `Exchanged ${asset} for USD`,
        amount: `−${xrp}`,
        status: st,
        party: '[Liquidity provider]',
        fee: 'Shown on the quote',
      };
    case 'yield_reward':
      return {
        ...base,
        kind: 'receive',
        title: 'Yield reward',
        amount: `+${xrp}`,
        status: st,
        party: '[Yield provider]',
        fee: formatAmount(big(r.fee_drops), asset),
      };
    case 'yield_allocate':
      return { ...base, kind: 'exchange', title: 'Allocated to yield', amount: xrp, status: st, party: '[Yield provider]', fee: 'None' };
    case 'yield_redeem':
      return { ...base, kind: 'exchange', title: 'Redeemed from yield', amount: xrp, status: st, party: '[Yield provider]', fee: 'None' };
    default:
      return {
        ...base,
        kind: 'exchange',
        title: kind === 'loan' ? 'Loan' : kind === 'loan_repay' ? 'Loan repayment' : 'Collateral top-up',
        amount: kind === 'loan_repay' ? fiat : xrp,
        status: st,
        party: '[Lending provider]',
        fee: 'None',
      };
  }
};

export const createLiveSource = (url: string, anonKey: string): DashboardSource => {
  const db: SupabaseClient = createBrowserClient(url, anonKey);
  const now = () => new Date();

  const call = async <T>(name: string, body: Row, idempotencyKey?: string): Promise<T> => {
    const { data, error } = await db.functions.invoke(name, {
      body,
      headers: { 'x-device-kind': 'laptop', 'x-device-name': 'Web browser', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const msg = ctx ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null;
      throw new Error(msg ?? error.message);
    }
    return data as T;
  };

  let assetsCache: Asset[] = [];
  // Resolves once load() has the holdings, so a chart requested first still charts the right portfolio.
  let markLoaded: () => void = () => undefined;
  const loaded = new Promise<void>((r) => (markLoaded = r));
  const priceMap = (): Record<string, bigint> => Object.fromEntries(assetsCache.map((a) => [a.id, a.priceMicro]));

  return {
    mode: 'live',
    needsTotp: true,
    feesDeducted: true,
    canBuy: false,

    load: async (): Promise<Snapshot> => {
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) throw new Error('unauthenticated');
      const [customer, balances, txs, notices, factors, allowlist, devices] = await Promise.all([
        db.from('customers').select('*').eq('id', auth.user.id).single(),
        db.from('balances').select('kind, asset, balance_drops'),
        db.from('transactions').select('*').order('created_at', { ascending: false }).limit(100),
        db.from('notifications').select('*').is('read_at', null).order('created_at', { ascending: false }).limit(10),
        db.auth.mfa.listFactors(),
        db.from('allowlist_addresses').select('id').is('removed_at', null),
        db.from('devices').select('name, location, last_active_at').is('revoked_at', null).order('last_active_at', { ascending: false }).limit(2),
      ]);
      const c = (customer.data ?? {}) as Row;
      // Every ledger account the customer has, summed per asset (available, reserved, yield, collateral).
      const units: Record<string, bigint> = {};
      for (const b of (balances.data ?? []) as Row[]) {
        const a = str(b.asset) || 'XRP';
        if (a !== 'USD') units[a] = (units[a] ?? 0n) + big(b.balance_drops);
      }
      assetsCache = (await assetsFrom(units, true)).assets;
      markLoaded();
      const pf = portfolioOf(assetsCache);
      const name = str(c.display_name || c.full_name);
      const created = c.created_at ? new Date(str(c.created_at)) : now();
      const last = ((devices.data ?? []) as Row[])[1] ?? ((devices.data ?? []) as Row[])[0];
      const months = Math.floor((now().getTime() - Date.parse(str(c.password_changed_at) || now().toISOString())) / (30 * 86_400_000));
      return {
        displayName: name,
        initials: name
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase())
          .join('')
          .slice(0, 2),
        email: str(c.email),
        verified: c.kyc_status === 'verified',
        displayCurrency: str(c.display_currency) || 'USD',
        assets: assetsCache,
        portfolioCents: pf.cents,
        portfolioChangeCents: pf.change,
        allTimeSuffix: `since ${monthYear(created)}`,
        txs: ((txs.data ?? []) as Row[]).map((r) => toTx(r, priceMap(), now())),
        notices: ((notices.data ?? []) as Row[]).map((n) => ({
          id: str(n.id),
          text: `${str(n.title)}. ${str(n.body)}`.replace(/\.\./g, '.'),
          time: listDate(new Date(str(n.created_at)), now()),
          tone: n.tone === 'warn' || n.tone === 'bad' ? 'warn' : 'accent',
        })),
        security: {
          twofa: (factors.data?.totp.length ?? 0) > 0 && c.mfa_disable_at === null,
          allowlist: Boolean(c.allowlist_enabled),
          allowlistCount: (allowlist.data ?? []).length,
          lastSignIn: last ? `${listDate(new Date(str(last.last_active_at)), now())} · ${str(last.name)}` : '—',
          passwordChanged: months < 1 ? 'Changed recently' : `Last changed ${months} month${months === 1 ? '' : 's'} ago`,
        },
        notifications: { receipts: c.email_receipts !== false, alerts: c.price_alerts === true },
      };
    },

    series: async (assetId, period) => {
      if (!assetId) await loaded;
      return historySeries(assetId ?? assetsCache.map((a) => ({ id: a.id, units: a.units, scale: a.scale })), period).catch(() => []);
    },

    deposit: async (assetId) => {
      const r = await call<{ address: string; tag: string | null; memo: string | null; network: string; mode: 'automatic' | 'reported' }>('deposit-address', {
        asset: assetId,
      });
      return { address: r.address, tag: r.tag ?? r.memo, network: r.network, real: true, mode: r.mode, open: !!r.address };
    },

    withdraw: async (input) => {
      try {
        const r = await call<{ transaction: Row }>(
          'withdraw-request',
          {
            asset: input.assetId,
            amountDrops: input.units.toString(),
            destination: input.destination,
            destinationTag: assetSpec(input.assetId).memo === 'tag' ? input.tag : null,
            memo: assetSpec(input.assetId).memo === 'memo' ? input.tag : null,
            totpCode: input.totpCode ?? '',
          },
          input.idempotencyKey,
        );
        return ok({ ref: str(r.transaction.ref), tx: toTx(r.transaction, priceMap(), now()) });
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'We couldn’t submit this withdrawal. Try again.');
      }
    },

    setSecurity: async (key, on) => {
      try {
        if (key === 'twofa') {
          if (on) return fail('Set up your authenticator in the mobile app: Profile → Security.');
          await call('security-update', { action: 'mfa-disable' });
          return ok(undefined, 'Two-factor turns off after a 24-hour hold. Withdrawals pause until then.');
        }
        await call('security-update', { action: 'allowlist-toggle', enabled: on });
        return ok(undefined);
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'That didn’t work. Try again.');
      }
    },
    setNotification: async (key, on) => {
      const { error } = await db.rpc('set_notification_prefs', { p_receipts: key === 'receipts' ? on : null, p_alerts: key === 'alerts' ? on : null });
      return error ? fail('Couldn’t save that setting. Try again.') : ok(undefined);
    },
    markRead: async () => {
      await db.rpc('mark_notifications_read', { p_ids: null });
    },
    signOut: async () => {
      const { error } = await db.auth.signOut();
      return error ? fail(error.message) : ok(undefined);
    },
    contactSupport: async () => fail('Messaging support from the web isn’t available yet. Use Help & Support in the mobile app.'),
    changePassword: async () => {
      const { data } = await db.auth.getUser();
      if (!data.user?.email) return fail('Sign in again to change your password.');
      await db.auth.resetPasswordForEmail(data.user.email);
      return ok(undefined, 'Check your email for a link to set a new password.');
    },
  };
};
