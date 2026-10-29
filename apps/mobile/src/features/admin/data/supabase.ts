import { asset as assetSpec, formatAmount, formatPrice, isAssetId, unitsToCents } from '@xrp/ledger';
import { providerNames } from '@xrp/providers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { age, hm, shortAddr, when, xrp2 } from './format';
import { livePrices } from './prices';
import { accountLabel, amountLabel, kindLabel, queueKind, statusLabel, txFilterKind } from './labels';
import type {
  ActionResult,
  AdminData,
  AssetRow,
  AuditRow,
  CheckTone,
  Custody,
  CustomerRecord,
  HoldingRow,
  IdentityCheck,
  JournalRow,
  QueueItem,
  Recon,
  ReconException,
  Role,
  Staff,
  TimelineRow,
  TxItem,
} from './types';

type Row = Record<string, unknown>;
const big = (v: unknown): bigint => (v === null || v === undefined ? 0n : BigInt(String(v)));
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const ROLE_WORD: Record<string, string> = { operations: 'Operations', compliance: 'Compliance', auditor: 'Auditor' };

const rows = async (q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> => {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
};

/** Journal of a transaction as debit/credit rows (signed lines: + debit, − credit). */
const journalOf = (lines: Row[]): JournalRow[] =>
  lines.map((l) => {
    const amount = big(l.amount_drops);
    const acc = (l.ledger_accounts as Row | null) ?? {};
    const asset = str(acc.asset) || 'XRP';
    const account = accountLabel(str(acc.kind), asset);
    const v = asset === 'XRP' ? xrp2(amount < 0n ? -amount : amount) : formatAmount(amount < 0n ? -amount : amount, asset, { minDecimals: 2, maxDecimals: 8 }).replace(` ${asset}`, '');
    return amount > 0n ? { account, dr: v, cr: '' } : { account, dr: '', cr: v };
  });

const timelineOf = (events: Row[]): TimelineRow[] =>
  events.map((e) => {
    const actor = str(e.actor_name) || 'System';
    const role = e.role ? ` (${ROLE_WORD[str(e.role)] ?? str(e.role)})` : '';
    const action = str(e.action);
    const who = e.actor_type === 'customer' ? 'Customer' : `${actor}${role}`;
    return { at: hm(new Date(str(e.at))), text: `${who} ${action.charAt(0).toLowerCase()}${action.slice(1)}` };
  });

/** One-line summary for the queue detail header. */
const summaryOf = (tx: Row): string => {
  const meta = (tx.meta as Row) ?? {};
  const asset = str(tx.asset) || 'XRP';
  const network = assetSpec(asset).network;
  switch (str(tx.kind)) {
    case 'withdrawal':
      return `To ${shortAddr(str(tx.counterparty), 19, 3)}${tx.destination_tag ? ` · tag ${str(tx.destination_tag)}` : ''}${meta.memo ? ` · memo ${str(meta.memo)}` : ''} · ${network}`;
    case 'deposit':
      return meta.reported_by
        ? `Reported by ${str(meta.reported_by)} · hash ${shortAddr(str(meta.tx_hash), 10, 6)} · confirm on ${network} before approving`
        : `Validated on ledger · no destination tag · sender ${shortAddr(str(tx.counterparty), 6, 3)}`;
    case 'exchange':
      return `${tx.counter_asset ? `Swap into ${str(tx.counter_asset)}` : 'Sale for USD'} · needs a firm quote at the live price`;
    case 'loan':
      return `${formatAmount(big(tx.amount_drops), asset)} collateral · starting LTV ${str(meta.starting_ltv)}`;
    default:
      return `${str(meta.product) || `${asset} Flexible`}`;
  }
};

export const createSupabaseData = (db: SupabaseClient, me: Staff): AdminData => {
  const now = () => new Date();

  /** Writes go through Edge Functions with the staff member's JWT; roles are checked again there and in SQL. */
  const call = async (name: string, body: Row): Promise<ActionResult & Row> => {
    // The session refreshes on the phone, so read the current token for every call.
    const accessToken = (await db.auth.getSession()).data.session?.access_token;
    if (!accessToken) return { ok: false, error: 'Your session ended. Sign in again.' };
    const res = await fetch(`${env.supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, apikey: env.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Row;
    return res.ok ? { ok: true, ...json } : { ok: false, error: str(json.error) || 'Something went wrong. Try again.' };
  };

  const customersById = async (ids: string[]): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const list = await rows(db.from('customers_masked').select('id, account_ref').in('id', ids));
    return new Map(list.map((c) => [str(c.id), str(c.account_ref)]));
  };

  const queue = async (): Promise<QueueItem[]> => {
    const since = new Date(now().getTime() - 60 * 60_000).toISOString();
    const approvals = await rows(
      db
        .from('approvals')
        .select(
          'id, required, requires_compliance, status, requested_by, checks, created_at, transactions(*), approval_decisions(staff_id, role, decision, reason, note, at)',
        )
        .order('created_at', { ascending: true })
        .limit(200),
    );
    // Pending items, plus ones decided in the last hour so the outcome stays visible.
    const visible = approvals.filter((a) => a.status === 'pending' || ((a.approval_decisions as Row[]) ?? []).some((d) => str(d.at) > since));
    const txs = visible.map((a) => a.transactions as Row);
    const refs = await customersById([...new Set(txs.map((t) => str(t.customer_id)).filter(Boolean))]);
    const staffIds = [...new Set(visible.flatMap((a) => ((a.approval_decisions as Row[]) ?? []).map((d) => str(d.staff_id))))];
    const names = staffIds.length
      ? new Map(
          (await rows(db.from('staff_roles').select('staff_id, display_name').in('staff_id', staffIds))).map((s) => [str(s.staff_id), str(s.display_name)]),
        )
      : new Map();
    const txIds = txs.map((t) => str(t.id));
    const lines = txIds.length
      ? await rows(
          db
            .from('journal_lines')
            .select('amount_drops, ledger_accounts(kind, asset), journal_entries!inner(transaction_id, created_at)')
            .in('journal_entries.transaction_id', txIds),
        )
      : [];
    const audit = txs.length
      ? await rows(
          db
            .from('audit_events')
            .select('at, actor_type, actor_name, role, action, target')
            .in(
              'target',
              txs.map((t) => str(t.ref)),
            )
            .order('id'),
        )
      : [];

    return visible.map((a): QueueItem => {
      const tx = a.transactions as Row;
      const decisions = ((a.approval_decisions as Row[]) ?? []).sort((x, y) => (str(x.at) < str(y.at) ? -1 : 1));
      const rejection = decisions.find((d) => d.decision === 'reject');
      const kind = queueKind(str(tx.kind));
      return {
        id: str(a.id),
        ref: str(tx.ref),
        customer: refs.get(str(tx.customer_id)) ?? 'Unattributed',
        kind,
        type:
          kind === 'deposit'
            ? (tx.meta as Row)?.reported_by
              ? `Deposit confirmation · ${str(tx.asset)}`
              : 'Deposit exception'
            : kindLabel(str(tx.kind), str(tx.status), (tx.meta as Row) ?? {}, str(tx.asset), (tx.counter_asset as string | null) ?? null),
        amount: amountLabel({ kind: str(tx.kind), amount_drops: tx.kind === 'loan' ? null : tx.amount_drops, amount_cents: tx.amount_cents, asset: tx.asset }, false),
        age: age(new Date(str(tx.created_at)), now()),
        summary: summaryOf(tx),
        checks: ((a.checks as [string, string, CheckTone][]) ?? []).map(([label, note, tone]) => ({ label, note, tone })),
        required: Number(a.required) === 2 ? 2 : 1,
        approvals: decisions
          .filter((d) => d.decision === 'approve')
          .map((d) => ({ who: names.get(str(d.staff_id)) ?? 'Staff', at: hm(new Date(str(d.at))), role: d.role as Role, staffId: str(d.staff_id) })),
        journal: journalOf(lines.filter((l) => str((l.journal_entries as Row).transaction_id) === str(tx.id))),
        audit: timelineOf(audit.filter((e) => e.target === tx.ref)),
        decided: rejection
          ? { kind: 'rejected', reason: str(rejection.reason), note: str(rejection.note) }
          : a.status === 'approved'
            ? { kind: 'approved' }
            : null,
        requestedBy: a.requested_by ? str(a.requested_by) : null,
        claimant: (tx.meta as Row)?.claimed_by ? (refs.get(str((tx.meta as Row).claimed_by)) ?? null) : null,
      };
    });
  };

  const transactions = async (): Promise<TxItem[]> => {
    const list = await rows(
      db
        .from('transactions')
        .select('*, approvals(id, status), transaction_events(at, actor, note, to_status)')
        .order('created_at', { ascending: false })
        .limit(200),
    );
    const refs = await customersById([...new Set(list.map((t) => str(t.customer_id)).filter(Boolean))]);
    const ids = list.map((t) => str(t.id));
    const lines = ids.length
      ? await rows(
          db
            .from('journal_lines')
            .select('amount_drops, ledger_accounts(kind, asset), journal_entries!inner(transaction_id)')
            .in('journal_entries.transaction_id', ids),
        )
      : [];
    return list.map((t): TxItem => {
      const meta = (t.meta as Row) ?? {};
      const [status, tone] = statusLabel(str(t.kind), str(t.status));
      const rowsKv: TxItem['rows'] = [];
      if (t.kind === 'withdrawal') {
        rowsKv.push({ k: 'To', v: shortAddr(str(t.counterparty), 19, 3), mono: true });
        if (t.destination_tag) rowsKv.push({ k: 'Destination tag', v: str(t.destination_tag), mono: true });
        if (meta.memo) rowsKv.push({ k: 'Memo', v: str(meta.memo), mono: true });
        rowsKv.push({ k: 'Network', v: assetSpec(str(t.asset) || 'XRP').network });
        rowsKv.push({ k: 'Fee', v: `${formatAmount(big(t.fee_drops), str(t.asset) || 'XRP', { minDecimals: 2, maxDecimals: 8 })}${t.asset === 'XRP' ? ' + network' : ''}` });
        if (t.ledger_hash) rowsKv.push({ k: t.asset === 'XRP' ? 'Ledger hash' : 'Transaction hash', v: shortAddr(str(t.ledger_hash), 6, 6), mono: true });
        if (t.ledger_index) rowsKv.push({ k: 'Ledger index', v: Number(t.ledger_index).toLocaleString('en-US'), mono: true });
      } else if (t.kind === 'deposit' && meta.reported_by) {
        rowsKv.push({ k: 'Network', v: assetSpec(str(t.asset)).network });
        rowsKv.push({ k: 'Transaction hash', v: shortAddr(str(meta.tx_hash), 10, 8), mono: true });
        if (t.counterparty) rowsKv.push({ k: 'From', v: shortAddr(str(t.counterparty), 6, 8), mono: true });
        rowsKv.push({ k: 'Reported by', v: meta.reported_by === 'staff' ? 'Staff' : 'Customer' });
      } else if (t.kind === 'deposit') {
        rowsKv.push({ k: 'From', v: shortAddr(str(t.counterparty), 6, 8), mono: true });
        rowsKv.push({ k: 'Destination tag', v: t.destination_tag ? str(t.destination_tag) : 'Missing', mono: Boolean(t.destination_tag) });
        if (meta.claimed_by) rowsKv.push({ k: 'Claimed by', v: refs.get(str(meta.claimed_by)) ?? str(meta.claimed_by) });
        if (t.ledger_index) rowsKv.push({ k: 'Ledger index', v: Number(t.ledger_index).toLocaleString('en-US'), mono: true });
      } else if (t.kind === 'exchange' || t.kind === 'loan') {
        const payout = meta.payout as Row | undefined;
        if (payout) {
          rowsKv.push({ k: 'Pay to', v: str(payout.bank) });
          rowsKv.push({ k: 'Account number', v: str(payout.account_number), mono: true });
          rowsKv.push({ k: 'Account name', v: str(payout.account_name) });
        } else if (t.counter_asset && t.counter_amount) {
          rowsKv.push({ k: 'Credit', v: formatAmount(big(t.counter_amount), str(t.counter_asset)) });
        }
        if (meta.reason) rowsKv.push({ k: 'Reason', v: str(meta.reason) });
      } else if (meta.reason) {
        rowsKv.push({ k: 'Reason', v: str(meta.reason) });
      }
      const pending = ((t.approvals as Row[] | Row | null) ? ([] as Row[]).concat(t.approvals as Row[]) : []).find((a) => a.status === 'pending');
      return {
        id: str(t.id),
        ref: str(t.ref),
        customer: refs.get(str(t.customer_id)) ?? 'Unattributed',
        kind: txFilterKind(str(t.kind)),
        type: kindLabel(str(t.kind), str(t.status), meta, str(t.asset) || 'XRP', (t.counter_asset as string | null) ?? null),
        amount: amountLabel({ kind: str(t.kind), amount_drops: t.amount_drops, amount_cents: t.amount_cents, asset: t.asset }, true),
        time: when(new Date(str(t.created_at)), now()),
        status,
        tone,
        rows: rowsKv,
        journal: journalOf(lines.filter((l) => str((l.journal_entries as Row).transaction_id) === str(t.id))),
        timeline: ((t.transaction_events as Row[]) ?? [])
          .sort((a, b) => (str(a.at) < str(b.at) ? -1 : 1))
          .map((e) => ({ at: hm(new Date(str(e.at))), text: `${str(e.actor)} · ${str(e.to_status).replace(/_/g, ' ')}${e.note ? ` · ${str(e.note)}` : ''}` })),
        queueId: pending ? str(pending.id) : null,
        asset: str(t.asset) || 'XRP',
        manualSend: t.kind === 'withdrawal' && t.status === 'approved' && isAssetId(str(t.asset)) && assetSpec(str(t.asset)).deposit !== 'automatic',
        settle:
          t.kind === 'exchange' && t.status === 'accepted'
            ? t.counter_asset
              ? 'swap'
              : 'usd'
            : t.kind === 'loan' && t.status === 'collateral_locked'
              ? 'loan'
              : t.kind === 'loan_repay' && t.status === 'awaiting_payment'
                ? 'repayment'
                : null,
      };
    });
  };

  /** Server prices recorded by the worker (what money actions use); live market data fills any gaps. */
  const priceMap = async (): Promise<Map<string, bigint>> => {
    const recorded = await rows(db.from('prices').select('asset, usd_micro, at').order('at', { ascending: false }).limit(500));
    const out = new Map<string, bigint>();
    for (const r of recorded) if (!out.has(str(r.asset))) out.set(str(r.asset), big(r.usd_micro));
    for (const [a, p] of await livePrices()) if (!out.has(a)) out.set(a, p.priceMicro);
    return out;
  };

  const customers = async (): Promise<CustomerRecord[]> => {
    const list = await rows(db.from('customers_masked').select('*').order('account_ref'));
    const balances = await rows(db.from('balances').select('customer_id, kind, asset, balance_drops').not('customer_id', 'is', null));
    const prices = await priceMap();
    const flags = await rows(db.from('customer_flags').select('customer_id, note').is('resolved_at', null));
    const latest = await rows(db.from('transactions').select('id, customer_id, created_at').order('created_at', { ascending: false }).limit(500));
    const devices = await rows(db.from('devices').select('customer_id, name, location, last_active_at, revoked_at').order('last_active_at', { ascending: false }));
    const events = await rows(db.from('security_events').select('customer_id, title, meta, created_at').order('created_at', { ascending: false }).limit(2000));
    const now = new Date();
    const holdingsOf = (id: string): HoldingRow[] => {
      const by = new Map<string, HoldingRow>();
      for (const b of balances.filter((x) => x.customer_id === id)) {
        const asset = str(b.asset) || 'XRP';
        const h = by.get(asset) ?? { asset, available: 0n, yield: 0n, collateral: 0n, reserved: 0n, valueCents: 0n };
        const v = big(b.balance_drops);
        const k = str(b.kind);
        if (k === 'available') h.available += v;
        else if (k === 'reserved') h.reserved += v;
        else if (k === 'yield' || k === 'pending_yield') h.yield += v;
        else if (k === 'collateral') h.collateral += v;
        by.set(asset, h);
      }
      return [...by.values()]
        .map((h) => ({ ...h, valueCents: unitsToCents(h.available + h.reserved + h.yield + h.collateral, prices.get(h.asset) ?? 0n, h.asset) }))
        .filter((h) => h.available + h.reserved + h.yield + h.collateral > 0n)
        .sort((a, b) => (b.valueCents > a.valueCents ? 1 : b.valueCents < a.valueCents ? -1 : 0));
    };
    return list.map((c) => {
      const id = str(c.id);
      const kyc = str(c.kyc_status);
      return {
        id,
        accountRef: str(c.account_ref),
        name: str(c.full_name),
        email: str(c.email),
        phone: str(c.phone),
        dob: str(c.dob),
        country: str(c.country),
        kyc:
          kyc === 'verified'
            ? `Verified · level ${str(c.kyc_level)}`
            : kyc === 'in_progress' || kyc === 'more_info'
              ? 'Pending review'
              : kyc.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()),
        kycTone: kyc === 'verified' ? 'ok' : kyc === 'rejected' ? 'bad' : 'wait',
        joined: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Lagos' }).format(
          new Date(str(c.created_at)),
        ),
        risk: str(c.risk_rating),
        holdings: holdingsOf(id),
        totalUsdCents: holdingsOf(id).reduce((s2, h) => s2 + h.valueCents, 0n),
        flags: flags.filter((f) => f.customer_id === id).map((f) => str(f.note)),
        frozen: c.frozen_at !== null,
        masked: me.role !== 'compliance',
        latestTxId: str(latest.find((t) => t.customer_id === id)?.id) || null,
        devices: devices
          .filter((d) => d.customer_id === id)
          .map((d) => ({ name: str(d.name), location: str(d.location), lastActive: when(new Date(str(d.last_active_at)), now), revoked: d.revoked_at !== null })),
        activity: events
          .filter((e) => e.customer_id === id)
          .slice(0, 10)
          .map((e) => ({ title: str(e.title), meta: str(e.meta), at: when(new Date(str(e.created_at)), now) })),
      };
    });
  };

  const recon = async (): Promise<Recon> => {
    const [run] = await rows(db.from('recon_runs').select('*').order('created_at', { ascending: false }).limit(1));
    const exc = run
      ? await rows(
          db
            .from('recon_exceptions')
            .select('*, transactions(ref, approvals(id, status))')
            .or(`status.neq.resolved,run_id.eq.${str(run.id)}`)
            .order('created_at'),
        )
      : [];
    const result = ((run?.result as Row) ?? {}) as Record<string, Row>;
    const wallet = (id: string, name: string, tier: 'hot' | 'warm' | 'cold') => ({
      name,
      tier,
      internal: big(result[id]?.internal),
      provider: big(result[id]?.provider),
      chain: big(result[id]?.chain),
    });
    const ws = [wallet('hot', 'Hot wallet', 'hot'), wallet('warm', 'Warm wallet', 'warm'), wallet('cold', 'Cold vault', 'cold')];
    const total = ws.reduce((t, w) => ({ ...t, internal: t.internal + w.internal, provider: t.provider + w.provider, chain: t.chain + w.chain }), {
      name: 'Total holdings',
      tier: 'total' as const,
      internal: 0n,
      provider: 0n,
      chain: 0n,
    });
    const liabilities = (result.liabilities as Row | undefined) ?? {};
    return {
      runRef: str(run?.ref),
      when: run ? `${when(new Date(str(run.created_at)), now())} WAT` : '—',
      validatedLedger: Number(run?.validated_ledger ?? 0),
      wallets: [...ws, total],
      customerLiabilitiesDrops: big(liabilities.customers),
      suspenseDrops: big(liabilities.suspense),
      exceptions: exc.map((e): ReconException => {
        const approvals = ([] as Row[]).concat(((e.transactions as Row | null)?.approvals as Row[]) ?? []);
        return {
          id: str(e.id),
          kind: e.kind as ReconException['kind'],
          title: str(e.title),
          note: str(e.note),
          status: e.status as ReconException['status'],
          statusNote: e.status_note ? str(e.status_note) : null,
          queueId: str(approvals.find((a) => a.status === 'pending')?.id) || null,
        };
      }),
    };
  };

  const custody = async (): Promise<Custody> => {
    const [wallets, signers, limits, changes, run] = await Promise.all([
      rows(db.from('custody_wallets').select('*')),
      rows(db.from('signers').select('*').order('status').order('name')),
      rows(db.from('limits').select('*')),
      rows(db.from('policy_changes').select('*').order('created_at', { ascending: false }).limit(1)),
      rows(db.from('recon_runs').select('result').order('created_at', { ascending: false }).limit(1)),
    ]);
    const result = ((run[0]?.result as Row) ?? {}) as Record<string, Row>;
    const startOfDay = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }) + 'T00:00:00+01:00').toISOString();
    const out = await rows(
      db
        .from('transactions')
        .select('amount_drops')
        .eq('kind', 'withdrawal')
        .in('status', ['approved', 'submitted', 'validated'])
        .gte('created_at', startOfDay),
    );
    const limit = (id: string) => big(limits.find((l) => l.id === id)?.amount_drops);
    const change = changes[0];
    const order = { hot: 0, warm: 1, cold: 2 } as Record<string, number>;
    return {
      wallets: wallets
        .sort((a, b) => (order[str(a.tier)] ?? 9) - (order[str(b.tier)] ?? 9))
        .map((w) => ({
          name: str(w.name),
          address: str(w.address),
          balanceDrops: big(result[str(w.id)]?.provider),
          signing: str(w.signing),
          ceilingDrops: w.ceiling_drops === null ? null : big(w.ceiling_drops),
          tier: str(w.tier),
        })),
      policyVersion: 'v3',
      policy: [
        ['Up to 1,000 XRP', '1 staff approval, then hot wallet auto-sign'],
        ['Over 1,000 XRP', '2 approvals, different people, one Compliance'],
        ['Warm → hot top-up', '2 of 3 signers'],
        ['Cold vault release', '3 of 5 signers · 24-hour time lock'],
        ['Destination check', 'Manual · the approver checks every address'],
        ['New customer address', '24-hour activation hold'],
      ],
      signers: signers.map((s) => ({ name: str(s.name), meta: str(s.meta), status: s.status === 'active' ? 'Active' : 'Standby' })),
      limits: {
        customerDailyDrops: limit('customer_daily'),
        autoSignDrops: limit('auto_sign'),
        platformDailyDrops: limit('platform_daily'),
        outflowTodayDrops: out.reduce((s, t) => s + big(t.amount_drops), 0n),
      },
      pendingChange: change
        ? {
            id: str(change.id),
            title: str(change.title),
            requestedBy:
              ((await rows(db.from('staff_roles').select('display_name').eq('staff_id', str(change.requested_by))))[0]?.display_name as string) ?? 'Staff',
            requestedRole: change.requested_role as Role,
            when: when(new Date(str(change.created_at)), now()).replace('Today', 'today'),
            reason: str(change.reason),
            status: change.status as 'pending' | 'approved' | 'declined',
            decidedByMe: change.decided_by === me.id,
          }
        : null,
    };
  };

  const audit = async () => {
    const [list, verif] = await Promise.all([
      rows(db.from('audit_events').select('id, at, actor_type, actor_id, actor_name, role, action, target, hash').order('id', { ascending: false }).limit(200)),
      rows(db.from('audit_verifications').select('*').order('verified_at', { ascending: false }).limit(1)),
    ]);
    return {
      verifiedAt: verif[0] ? hm(new Date(str(verif[0].verified_at))) : '—',
      chainOk: verif[0] ? verif[0].broken_at_id === null : true,
      rows: list.map((a): AuditRow => ({
        id: str(a.id),
        at: hm(new Date(str(a.at))),
        actor: a.actor_id === me.id ? `You · ${ROLE_WORD[me.role]}` : str(a.actor_name),
        actorType: a.actor_type as AuditRow['actorType'],
        action: str(a.action),
        target: str(a.target),
        hash: `${str(a.hash).slice(0, 8)}…`,
      })),
    };
  };

  return {
    mode: 'supabase',
    me: async () => me,
    queue,
    transactions,
    customers,
    recon,
    custody,
    audit,
    overview: async () => {
      const [q, r, c, beat, price, kyc] = await Promise.all([
        queue(),
        recon(),
        custody(),
        rows(db.from('worker_heartbeat').select('*').order('at', { ascending: false }).limit(1)),
        rows(db.from('prices').select('usd_micro, at, source').eq('asset', 'XRP').order('at', { ascending: false }).limit(1)),
        rows(db.from('customers_masked').select('id').in('kyc_status', ['in_progress', 'more_info'])),
      ]);
      const pending = q.filter((i) => !i.decided);
      const oldest = pending[0];
      const holdings = r.wallets.find((w) => w.tier === 'total')?.provider ?? 0n;
      const liabilities = r.customerLiabilitiesDrops + r.suspenseDrops;
      const open = r.exceptions.filter((e) => e.status !== 'resolved');
      const hb = beat[0];
      // The ledger is checked every 10 minutes while anyone has the app open; 30 minutes without a check is stale.
      const stale = !hb || now().getTime() - Date.parse(str(hb.at)) > 30 * 60_000;
      const p = price[0];
      const pct = liabilities === 0n ? '100.00%' : `${(Number((holdings * 10_000n) / liabilities) / 100).toFixed(2)}%`;
      return {
        pending: pending.length,
        oldest: oldest ? `Oldest ${oldest.age} · ${oldest.ref}` : 'Nothing waiting',
        liabilitiesDrops: liabilities,
        coveragePct: pct,
        exceptionsOpen: open.length,
        lastRun: r.when.split(' ')[1] ?? '—',
        outflowTodayDrops: c.limits.outflowTodayDrops,
        outflowLimitDrops: c.limits.platformDailyDrops,
        providers: [
          { name: 'Platform wallets', note: 'Balances from the latest reconciliation', status: 'Operational', tone: 'ok' },
          {
            name: 'XRP Ledger nodes',
            note: hb
              ? `Validated ledger ${Number(hb.validated_ledger).toLocaleString('en-US')} · ${str(hb.nodes_in_sync)} of 2 nodes answered · checked ${hm(new Date(str(hb.at)))}`
              : 'Not checked yet',
            status: stale ? 'Outage' : Number(hb?.nodes_in_sync) < 2 ? 'Degraded' : 'Operational',
            tone: stale ? 'bad' : Number(hb?.nodes_in_sync) < 2 ? 'wait' : 'ok',
          },
          { name: 'Identity checks', note: `${kyc.length} waiting for Compliance`, status: 'Operational', tone: kyc.length ? 'wait' : 'ok' },
          { name: 'Address checks', note: 'Manual · checked by the approver', status: 'Operational', tone: 'ok' },
          { name: 'Earn', note: 'Run by the platform · rewards paid daily', status: 'Operational', tone: 'ok' },
          {
            name: 'Borrow',
            note: `${q.filter((i) => i.kind === 'loan' && !i.decided).length} credit decision pending`,
            status: 'Operational',
            tone: 'ok',
          },
          {
            name: providerNames.prices,
            note: p ? `XRP ${formatPrice(big(p.usd_micro), 2)} · updated ${hm(new Date(str(p.at)))}` : 'No price yet',
            status: p ? 'Operational' : 'Outage',
            tone: p ? 'ok' : 'bad',
          },
        ],
        attention: [
          ...pending
            .filter((i) => i.required === 2)
            .slice(0, 1)
            .map((i) => ({
              title: `${i.ref} needs a second approval`,
              note: `${i.amount} · over 1,000 XRP threshold`,
              where: 'Queue' as const,
              href: `/queue?sel=${i.id}`,
              tone: 'wait' as const,
            })),
          ...open
            .filter((e) => e.kind === 'deposit_no_tag')
            .slice(0, 1)
            .map((e) => ({
              title: e.title,
              note: e.note.replace('held in suspense', 'in suspense'),
              where: 'Reconciliation' as const,
              href: '/reconciliation',
              tone: 'bad' as const,
            })),
          ...(c.pendingChange?.status === 'pending'
            ? [{ title: 'Signing policy change waiting', note: c.pendingChange.title, where: 'Custody' as const, href: '/custody', tone: 'wait' as const }]
            : []),
        ],
      };
    },

    identity: async (customerId) => {
      const [k] = await rows(
        db.from('kyc_checks').select('status, document_type, issuing_country, documents, created_at, decided_at').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(1),
      );
      if (!k) return null;
      const paths = (k.documents as string[] | null) ?? [];
      // Only Compliance can read the kyc bucket; for other roles the links come back empty.
      const signed = me.role === 'compliance' && paths.length ? (await db.storage.from('kyc').createSignedUrls(paths, 300)).data ?? [] : [];
      return {
        status: str(k.status) as IdentityCheck['status'],
        documentType: (k.document_type as string | null) ?? null,
        country: (k.issuing_country as string | null) ?? null,
        submittedAt: str(k.created_at),
        decidedAt: (k.decided_at as string | null) ?? null,
        documents: paths.map((p, i) => ({ name: p.split('/').pop() ?? p, url: signed[i]?.signedUrl ?? null })),
      };
    },
    customerExtras: async (customerId) => {
      const { data, error } = await db.rpc('staff_customer_profile', { p_customer: customerId });
      if (error) throw new Error(error.message);
      const d = data as Row;
      const a = (d.address as Row) ?? {};
      const t = d.trust as Row | null;
      return {
        address: { line: (a.line as string | null) ?? null, city: (a.city as string | null) ?? null, region: (a.region as string | null) ?? null, postalCode: (a.postal_code as string | null) ?? null, country: str(a.country) },
        trust: t ? { ref: str(t.ref), type: str(t.type), status: str(t.status), createdAt: str(t.created_at), termsAgreedAt: str(t.terms_agreed_at) } : null,
        beneficiaries: ((d.beneficiaries as Row[]) ?? []).map((b) => ({
          name: str(b.name),
          relationship: str(b.relationship),
          isSelf: Boolean(b.is_self),
          allocationPct: Number(b.allocation_pct),
          email: (b.email as string | null) ?? null,
          wallet: (b.wallet as string | null) ?? null,
        })),
        wallets: ((d.wallets as Row[]) ?? []).map((w) => ({ network: str(w.network), access: str(w.access), address: str(w.address), balances: (w.balances as Record<string, string>) ?? {} })),
      };
    },
    decideIdentity: async (customerId, decision, note) => {
      const { error } = await db.rpc('kyc_review', { p_customer: customerId, p_decision: decision, p_note: note || null });
      if (error) return { ok: false, error: error.message };
      return { ok: true, message: decision === 'verified' ? 'Identity verified. The customer can now use their account.' : 'Decision saved. The customer has been told why.' };
    },
    recordViewed: async (customerId) => {
      if (me.role !== 'compliance') return;
      const { error } = await db.rpc('open_customer_record', { p_customer: customerId });
      if (error) throw new Error(error.message);
    },
    decide: (queueId, decision, reason, note) =>
      call('approval-decide', { approvalId: queueId, decision, ...(reason ? { reason } : {}), ...(note ? { note } : {}) }),
    runRecon: async () => {
      const r = await call('recon-run', {});
      return r.ok ? { ok: true, message: 'Reconciliation run complete.' } : r;
    },
    bookFee: async (id) => {
      const r = await call('recon-adjust', { exceptionId: id, reason: 'Book network fees found by reconciliation' });
      return r.ok ? { ok: true, message: 'Fee adjustment posted as a balanced journal entry.' } : r;
    },
    contactProvider: async (id) => {
      const r = await call('recon-contact', { exceptionId: id });
      return r.ok ? { ok: true, message: 'Noted. The exception stays open until the provider confirms.' } : r;
    },
    flagCustomer: async (id) => {
      const r = await call('customer-flag', { customerId: id, note: `Flagged for review by ${me.name}` });
      return r.ok ? { ok: true, message: 'Flagged for Compliance review.' } : r;
    },
    setFrozen: async (id, frozen) => {
      const r = await call('customer-freeze', { customerId: id, frozen });
      return r.ok ? { ok: true, message: frozen ? 'Frozen. Withdrawals and new requests are blocked.' : 'Unfrozen.' } : r;
    },
    settle: async (txId, kind, reference) => {
      const r = await call(kind === 'usd' || kind === 'swap' ? 'exchange-complete' : 'loan-settle', { transactionId: txId, reference });
      return r.ok ? { ok: true, message: 'Completed. The customer has been told.' } : r;
    },
    resetPassword: async (id) => {
      const r = await call('customer-password-reset', { customerId: id });
      return r.ok ? { ok: true, email: str(r.email), password: str(r.password) } : r;
    },
    decidePolicy: async (id, decision) => {
      const r = await call('policy-decide', { policyChangeId: id, decision });
      return r.ok ? { ok: true, message: decision === 'approve' ? 'Approved. The new ceiling applies after a 24-hour delay.' : 'Change declined.' } : r;
    },
    exportAudit: async (filter) => {
      const r = await call('audit-export', { filter });
      return r.ok ? { ok: true, message: 'Export ready. The export itself is recorded in the log.', csv: str(r.csv), filename: str(r.filename) } : r;
    },

    assets: async (): Promise<AssetRow[]> => {
      const [all, nets, bal, txs, live] = await Promise.all([
        rows(db.from('assets').select('*').order('sort')),
        rows(db.from('asset_networks').select('asset, network, name, deposit_address').order('sort')),
        rows(db.from('balances').select('asset, balance_drops, customer_id').not('customer_id', 'is', null)),
        rows(db.from('transactions').select('asset, kind, status, meta').in('status', ['reported', 'approved'])),
        livePrices(),
      ]);
      const prices = await priceMap();
      // Only coins this app version knows; the rest of the table is history.
      const cfg = all.filter((r) => isAssetId(str(r.id)));
      return cfg.map((r): AssetRow => {
        const id = str(r.id);
        const p = live.get(id);
        return {
          id,
          name: str(r.name),
          network: str(r.network),
          depositMode: r.deposit_mode === 'automatic' ? 'automatic' : 'reported',
          depositAddress: (r.deposit_address as string | null) ?? null,
          depositMemo: (r.deposit_memo as string | null) ?? null,
          memoKind: (r.memo_kind as 'tag' | 'memo' | null) ?? null,
          networks: nets
            .filter((n) => n.asset === id)
            .map((n) => ({ id: str(n.network), name: str(n.name), address: (n.deposit_address as string | null) ?? null })),
          enabled: Boolean(r.enabled),
          priceMicro: prices.get(id) ?? 0n,
          changeBps: p?.changeBps ?? 0,
          priceAt: p?.at ?? '',
          liabilities: bal.filter((b) => b.asset === id).reduce((s2, b) => s2 + big(b.balance_drops), 0n),
          pendingDeposits: txs.filter((t) => t.asset === id && t.kind === 'deposit' && t.status === 'reported').length,
          awaitingSend: txs.filter((t) => t.asset === id && t.kind === 'withdrawal' && t.status === 'approved' && r.deposit_mode !== 'automatic').length,
        };
      });
    },
    updateAsset: async (asset, depositAddress, memo, enabled, networks) => {
      const r = await call('asset-update', { asset, depositAddress, memo, enabled, ...(networks ? { networks } : {}) });
      return r.ok ? { ok: true, message: `${asset} settings saved.` } : r;
    },
    recordDeposit: async (customerId, asset, amountUnits, txHash, note) => {
      const r = await call('deposit-record', { customerId, asset, amountUnits: amountUnits.toString(), txHash, note });
      return r.ok ? { ok: true, message: 'Deposit recorded. A second staff member approves the credit in the queue.' } : r;
    },
    completeWithdrawal: async (txId, outcome) => {
      const r = await call(
        'withdrawal-complete',
        outcome.action === 'sent' ? { action: 'sent', transactionId: txId, txHash: outcome.txHash } : { action: 'failed', transactionId: txId, reason: outcome.reason },
      );
      return r.ok ? { ok: true, message: outcome.action === 'sent' ? 'Marked sent. The fee is booked and the customer notified.' : 'Marked failed. The funds are back in the customer’s balance.' } : r;
    },
    changePassword: async (current, next) => {
      const r = await call('staff-password-change', { current, next });
      return r.ok ? { ok: true, message: 'Password updated. Other devices were signed out.' } : r;
    },
  };
};
