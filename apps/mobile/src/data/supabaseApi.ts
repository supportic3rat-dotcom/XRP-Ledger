import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FnName } from '@xrp/schemas';
import type { AppNotification, Consent, KycStatus, Transaction, TxEvent } from '@xrp/types';
import { env } from '@/lib/env';
import { deviceHeaders } from '@/lib/device';
import { secureStorage } from '@/lib/secureStorage';
import { ASSETS, assetLimits } from '@xrp/ledger';
import type { Api, AssetInfo, FirmQuote, Holding, LegalDoc, ProviderStatus } from './api';

type Row = Record<string, unknown>;
const big = (v: unknown): bigint => (v === null || v === undefined ? 0n : BigInt(String(v)));
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

let client: SupabaseClient | null = null;
export const supabase = (): SupabaseClient => {
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  return client;
};

const uid = async (): Promise<string> => {
  const { data } = await supabase().auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
};

/** Calls an Edge Function. Money functions get an Idempotency-Key so retries never double-post. */
const call = async <T>(name: FnName, body: Row, idempotencyKey?: string): Promise<T> => {
  const { data, error } = await supabase().functions.invoke(name, {
    body,
    headers: { ...deviceHeaders(), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    const message = context ? ((await context.json().catch(() => null)) as { error?: string } | null)?.error : null;
    throw new Error(message ?? error.message);
  }
  return data as T;
};

/** Money functions answer `{ transaction }` with the raw row; events arrive later over Realtime. */
const callTx = async (name: FnName, body: Row, idempotencyKey?: string): Promise<Transaction> =>
  toTx((await call<{ transaction: Row }>(name, body, idempotencyKey)).transaction, []);

const toTx = (r: Row, events: Row[]): Transaction => ({
  id: str(r.id),
  ref: str(r.ref),
  customerId: str(r.customer_id),
  kind: r.kind as Transaction['kind'],
  status: r.status as Transaction['status'],
  asset: str(r.asset) || 'XRP',
  counterAsset: (r.counter_asset as string | null) ?? null,
  counterAmount: r.counter_amount === null || r.counter_amount === undefined ? null : big(r.counter_amount),
  ...(r.amount_drops !== null ? { amountDrops: big(r.amount_drops) } : {}),
  ...(r.amount_cents !== null ? { amountCents: big(r.amount_cents) } : {}),
  platformFeeDrops: big(r.fee_drops),
  networkFeeDrops: big(r.network_fee_drops),
  createdAt: str(r.created_at),
  counterparty: str(r.counterparty),
  destinationTag: r.destination_tag === null ? null : str(r.destination_tag),
  ledgerHash: (r.ledger_hash as string | null) ?? null,
  ledgerIndex: (r.ledger_index as number | null) ?? null,
  meta: (r.meta as Record<string, string>) ?? {},
  events: events
    .filter((e) => e.transaction_id === r.id)
    .map((e): TxEvent => ({
      fromStatus: (e.from_status as never) ?? null,
      toStatus: e.to_status as never,
      at: str(e.at),
      actor: str(e.actor),
      ...(e.note ? { note: str(e.note) } : {}),
    })),
});

export const createSupabaseApi = (): Api => ({
  mode: 'supabase',
  now: () => new Date(),

  signIn: async (email, password) => {
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) {
      const locked = error.status === 429;
      return { status: 'error', attemptsLeft: locked ? 0 : 4, locked };
    }
    return { status: 'ok' };
  },
  requestPasswordReset: async (email) => {
    // Always resolves, so the UI never reveals whether the email exists.
    await supabase()
      .auth.resetPasswordForEmail(email)
      .catch(() => undefined);
  },
  signUp: async (input) => {
    const { data, error } = await supabase().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { full_name: input.name, country: input.country, display_currency: input.currency, marketing_opt_in: input.updates } },
    });
    if (error) throw new Error(error.message);
    // No session means "Confirm email" is still on in Supabase Auth; sign-up has no code step to finish it.
    if (!data.session) throw new Error('Your account was created but can’t be opened yet. Please contact support.');
  },
  signOut: async () => {
    await supabase().auth.signOut();
  },

  profile: async () => {
    const id = await uid();
    const { data: c } = await supabase().from('customers').select('*').eq('id', id).single();
    const row = (c ?? {}) as Row;
    const name = str(row.full_name);
    return {
      id,
      accountRef: str(row.account_ref),
      fullName: name,
      displayName: str(row.display_name),
      initials: name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      email: str(row.email),
      country: str(row.country),
      currency: (row.display_currency as never) ?? 'USD',
      kycStatus: row.kyc_status as KycStatus,
      allowlistEnabled: Boolean(row.allowlist_enabled),
      passwordChangedAt: str(row.password_changed_at),
      frozen: row.frozen_at !== null,
    };
  },
  assets: async () => {
    const { data } = await supabase().from('assets').select('id, deposit_mode, deposit_address, enabled, yield_apr_bps, collateral').order('sort');
    const rows = new Map(((data ?? []) as Row[]).map((r) => [str(r.id), r]));
    // The registry (decimals, address formats, limits) ships with the app; the server says what's enabled and where deposits go.
    return ASSETS.filter((a) => rows.get(a.id)?.enabled !== false).map((a): AssetInfo => {
      const r = rows.get(a.id);
      return {
        id: a.id,
        name: a.name,
        network: a.network,
        decimals: a.decimals,
        memo: a.memo,
        depositMode: a.deposit,
        depositOpen: a.deposit === 'automatic' || !!r?.deposit_address,
        yieldAprBps: r ? ((r.yield_apr_bps as number | null) ?? null) : a.yieldAprBps,
        collateral: r ? Boolean(r.collateral) : a.collateral,
        limits: assetLimits(a.id),
      };
    });
  },
  holdings: async () => {
    const { data } = await supabase().from('balances').select('kind, asset, balance_drops');
    const by = new Map<string, Holding>();
    for (const r of (data ?? []) as Row[]) {
      const asset = str(r.asset) || 'XRP';
      if (asset === 'USD') continue;
      const h = by.get(asset) ?? { asset, available: 0n, reserved: 0n, pendingYield: 0n, yield: 0n, collateral: 0n };
      const key = ({ available: 'available', reserved: 'reserved', pending_yield: 'pendingYield', yield: 'yield', collateral: 'collateral' } as const)[
        str(r.kind) as 'available'
      ];
      if (key) h[key] += big(r.balance_drops);
      by.set(asset, h);
    }
    return [...by.values()];
  },
  transactions: async () => {
    const { data: txs } = await supabase().from('transactions').select('*').order('created_at', { ascending: false }).limit(200);
    const ids = (txs ?? []).map((t: Row) => t.id);
    const { data: events } = ids.length ? await supabase().from('transaction_events').select('*').in('transaction_id', ids).order('at') : { data: [] };
    return (txs ?? []).map((t: Row) => toTx(t, (events ?? []) as Row[]));
  },
  notifications: async () => {
    const { data } = await supabase().from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
    return (data ?? []).map((n: Row): AppNotification => ({
      id: str(n.id),
      type: n.type as never,
      tone: n.tone as never,
      icon: n.icon as never,
      title: str(n.title),
      body: str(n.body),
      createdAt: str(n.created_at),
      link: str(n.link),
      readAt: (n.read_at as string | null) ?? null,
    }));
  },
  depositInfo: async (asset) => {
    const r = await call<Row>('deposit-address', { asset });
    return {
      asset: str(r.asset),
      mode: r.mode as 'automatic' | 'reported',
      address: str(r.address),
      tag: (r.tag as string | null) ?? null,
      memo: (r.memo as string | null) ?? null,
      network: str(r.network),
      testnet: Boolean(r.testnet),
      minDrops: big(r.minDrops),
    };
  },
  loan: async () => {
    const { data } = await supabase().from('loans').select('*').in('status', ['active', 'margin_call', 'liquidating']).limit(1).maybeSingle();
    if (!data) return null;
    const r = data as Row;
    return {
      id: str(r.id),
      ref: str(r.ref),
      principalCents: big(r.principal_usd_cents) - big(r.repaid_usd_cents),
      interestCents: big(r.interest_usd_cents),
      aprBps: Number(r.apr_bps),
      collateralDrops: big(r.collateral_drops),
      collateralAsset: str(r.collateral_asset) || 'XRP',
      marginBps: Number(r.margin_bps),
      liquidationBps: Number(r.liquidation_bps),
      status: r.status as never,
      fundedAt: str(r.funded_at),
      nextInterestDue: str(r.next_interest_due),
      originationFeeCents: big(r.origination_fee_cents),
    };
  },
  yieldPositions: async () => {
    const { data } = await supabase().from('yield_positions').select('*');
    return ((data ?? []) as Row[]).map((r) => ({
      product: str(r.product),
      asset: str(r.asset) || 'XRP',
      allocatedDrops: big(r.allocated_drops),
      aprBps: Number(r.apr_bps),
      feeBps: Number(r.fee_bps),
      since: str(r.since),
      creditedDrops: big(r.credited_drops),
      confirmedUnpaidDrops: big(r.confirmed_unpaid_drops),
      estimatedAccruedDrops: big(r.estimated_accrued_drops),
    }));
  },
  allowlist: async () => {
    const { data } = await supabase().from('allowlist_addresses').select('*').is('removed_at', null).order('created_at');
    return (data ?? []).map((r: Row) => ({
      id: str(r.id),
      asset: str(r.asset) || 'XRP',
      memo: (r.memo as string | null) ?? null,
      label: str(r.label),
      address: str(r.address),
      tag: r.tag === null ? null : str(r.tag),
      activeFrom: str(r.active_from),
    }));
  },
  devices: async () => {
    const { data } = await supabase().from('devices').select('*').is('revoked_at', null).order('last_active_at', { ascending: false });
    const { data: session } = await supabase().auth.getSession();
    return (data ?? []).map((r: Row) => ({
      id: str(r.id),
      name: str(r.name),
      location: str(r.location),
      lastActive: str(r.last_active_at),
      kind: r.kind as never,
      current: str(r.session_id) === str((session.session as unknown as Row | null)?.session_id ?? ''),
    }));
  },
  securityEvents: async () => {
    const { data } = await supabase().from('security_events').select('*').order('created_at', { ascending: false }).limit(10);
    return (data ?? []).map((r: Row) => ({ id: str(r.id), title: str(r.title), meta: str(r.meta), at: str(r.created_at) }));
  },
  tickets: async () => {
    const { data: tickets } = await supabase().from('support_tickets').select('*').order('created_at', { ascending: false });
    const refs = (tickets ?? []).map((t: Row) => t.ref);
    const { data: msgs } = refs.length ? await supabase().from('ticket_messages').select('*').in('ticket_ref', refs).order('created_at') : { data: [] };
    return (tickets ?? []).map((t: Row) => ({
      ref: str(t.ref),
      subject: str(t.subject),
      topic: str(t.topic),
      transactionRef: (t.transaction_ref as string | null) ?? null,
      createdAt: str(t.created_at),
      status: t.status as never,
      messages: ((msgs ?? []) as Row[])
        .filter((m) => m.ticket_ref === t.ref)
        .map(
          (m) =>
            ({
              from: m.author === 'customer' ? 'me' : 'them',
              text: str(m.body),
              meta: m.author === 'auto' ? 'Automatic reply' : m.author === 'customer' ? 'You' : 'Support',
            }) as const,
        ),
    }));
  },
  legalDocuments: async () => {
    const { data } = await supabase().from('legal_documents').select('*').order('sort');
    return (data ?? []).map((r: Row): LegalDoc => ({
      id: r.id as never,
      group: r.grp as never,
      name: str(r.name),
      version: str(r.current_version),
      requiresAcceptance: Boolean(r.requires_acceptance),
      changeSummary: (r.change_summary as string | null) ?? null,
      sections: r.sections as [string, string][],
    }));
  },
  consents: async () => {
    const { data } = await supabase().from('consents').select('*').order('accepted_at');
    return (data ?? []).map((r: Row): Consent => ({
      document: r.document as never,
      version: str(r.version),
      acceptedAt: str(r.accepted_at),
      surface: str(r.surface),
      consentId: str(r.id),
    }));
  },
  externalWallets: async () => {
    const { data } = await supabase().from('external_wallets').select('*').is('removed_at', null);
    return (data ?? []).map((r: Row) => ({ address: str(r.address), access: r.access as never, balanceDrops: big(r.balance_drops) }));
  },
  custodyStatus: async () => {
    const r = await call<{ provider: { status: ProviderStatus }; reconciledAt: string | null; subAccount: string }>('security-update', {
      action: 'custody-status',
    });
    return { provider: r.provider.status, reconciledAt: r.reconciledAt ?? '', subAccount: r.subAccount };
  },

  markNotificationsRead: async (ids) => {
    await supabase().rpc('mark_notifications_read', { p_ids: ids ?? null });
  },
  reportDeposit: async (input) =>
    callTx('deposit-report', { asset: input.asset, amountUnits: input.amountUnits.toString(), txHash: input.txHash, from: input.from }, input.idempotencyKey),
  requestWithdrawal: async (input) =>
    callTx(
      'withdraw-request',
      {
        asset: input.asset,
        amountDrops: input.amountDrops.toString(),
        destination: input.destination,
        destinationTag: input.destinationTag,
        memo: input.memo,
      },
      input.idempotencyKey,
    ),
  cancelWithdrawal: async (id) => {
    await call('withdraw-cancel', { transactionId: id });
  },
  requestExchange: async (input) =>
    callTx('exchange-request', { asset: input.asset, toAsset: input.toAsset, amountDrops: input.amountDrops.toString() }, input.idempotencyKey),
  currentQuote: async (txId) => {
    const r = await call<Row | null>('quote-current', { transactionId: txId });
    return r
      ? ({
          quoteId: str(r.id),
          priceMicro: big(r.price_micro),
          feeCents: big(r.fee_cents),
          receiveCents: big(r.receive_cents),
          ...(r.receive_units !== null && r.receive_units !== undefined ? { receiveUnits: big(r.receive_units) } : {}),
          expiresAt: str(r.expires_at),
        } satisfies FirmQuote)
      : null;
  },
  acceptQuote: async (txId, quoteId) => {
    await call('exchange-accept', { transactionId: txId, quoteId });
  },
  requestNewQuote: async (txId) => {
    await call('exchange-request', { requote: txId, amountDrops: '0' });
  },
  cancelExchange: async (txId) => {
    await call('exchange-cancel', { transactionId: txId });
  },
  allocateYield: async (input) =>
    callTx('yield-allocate', { asset: input.asset, amountDrops: input.amountDrops.toString(), termsVersion: 'v0.1' }, input.idempotencyKey),
  redeemYield: async (input) => callTx('yield-redeem', { asset: input.asset, amountDrops: input.amountDrops.toString() }, input.idempotencyKey),
  applyLoan: async (input) =>
    callTx(
      'loan-apply',
      { asset: input.asset, collateralDrops: input.collateralDrops.toString(), principalCents: input.principalCents.toString(), agreementVersion: 'v0.1' },
      input.idempotencyKey,
    ),
  repayLoan: async (input) => callTx('loan-repay', { loanId: input.loanId, amountCents: input.amountCents.toString(), via: input.via }, input.idempotencyKey),
  addCollateral: async (input) =>
    callTx('loan-add-collateral', { loanId: input.loanId, amountDrops: input.amountDrops.toString(), acknowledged: true }, input.idempotencyKey),
  setAllowlist: async (enabled) => {
    await call('security-update', { action: 'allowlist-toggle', enabled });
  },
  changePassword: async (current, next) => {
    await call('security-update', { action: 'password-change', current, next });
  },
  addAllowlistAddress: async (input) => {
    await call('allowlist-add', input);
  },
  removeAllowlistAddress: async (id) => {
    await call('allowlist-remove', { id });
  },
  revokeDevice: async (id) => {
    await call('device-revoke', { deviceId: id });
  },
  createTicket: async (input) => call(input.email ? 'ticket-create-public' : 'ticket-create', input),
  acceptConsent: async (document, version) => call('consent-accept', { document, version }),
  setDisplayCurrency: async (currency) => {
    await supabase().rpc('set_display_currency', { p_currency: currency });
  },
  addWatchWallet: async (address) => {
    await call('external-wallet', { action: 'add', address, access: 'watch' });
  },
  addSelfCustodyWallet: async (address) => {
    await call('external-wallet', { action: 'add', address, access: 'self_custody' });
  },
  removeExternalWallet: async (address) => {
    await call('external-wallet', { action: 'remove', address });
  },
  kycStatus: async () => (await supabase().from('customers').select('kyc_status').single()).data?.kyc_status as KycStatus,
  submitKyc: async (input) => call('kyc-session', input),
});
