'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ChangeEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { Asset, DashboardSource, DepositInfo, PeriodId, SeriesPoint, Snapshot, Tx } from './data/types';
import { PERIOD_IDS } from './data/types';
import { isAssetAddress, isAssetId } from '@xrp/ledger';
import { centsOf, formatUnits, formatUnitsPrecise, parseUnits, priceText, usdCents, usdOf } from './money';
import { PERIODS } from './series';

export type View = 'overview' | 'activity' | 'markets' | 'earn' | 'settings' | 'help' | 'asset';
type Modal = 'receive' | 'send' | 'buy' | 'tx' | null;
type SendState = {
  step: 1 | 2 | 3 | 4;
  asset: string;
  amount: string;
  address: string;
  tag: string;
  code: string;
  confirm: boolean;
  tried1: boolean;
  tried2: boolean;
  tried3: boolean;
  ref: string;
  error: string;
  busy: boolean;
  key: string;
};

const PAGES: Record<Exclude<View, 'asset'>, [string, string]> = {
  overview: ['Overview', 'Your portfolio at a glance.'],
  activity: ['Activity', 'Deposits, withdrawals and exchanges on your account.'],
  markets: ['Markets', 'Live prices for every supported asset.'],
  earn: ['Earn', 'Programs for idle assets.'],
  settings: ['Settings', 'Profile, security and notifications.'],
  help: ['Help & Support', 'Guides and ways to reach the support team.'],
};
const GUIDES = [
  {
    id: 'tag',
    title: 'Sending XRP with a destination tag',
    body: 'Custodial XRP accounts share one deposit address, so the destination tag tells the receiver which customer the funds belong to. Copy both the address and the tag when you deposit, and ask for a tag when you withdraw to an exchange.',
  },
  {
    id: 'pending',
    title: 'Why is my deposit still pending?',
    body: 'A deposit stays Pending until the network confirms it and it is credited to your account. XRP Ledger transactions usually confirm within seconds; Bitcoin and Ethereum need several block confirmations, which can take longer when networks are busy.',
  },
  {
    id: 'network',
    title: 'Choosing the right network',
    body: 'Each asset here can only be sent and received on its own network. Sending an asset on a network the recipient doesn’t support can make the funds unrecoverable, so confirm the network with the recipient before you withdraw.',
  },
  {
    id: 'secure',
    title: 'Keeping your account secure',
    body: 'Keep two-factor authentication on and consider turning on the withdrawal allowlist. We will never ask for your password, two-factor codes or a recovery phrase, by email, chat or phone.',
  },
];
const STATUS: Record<Tx['status'], { label: string; note: string; noteCls: string }> = {
  completed: { label: 'Completed', note: 'Confirmed on the network and reflected in your balance.', noteCls: 'info' },
  pending: { label: 'Pending', note: 'Waiting for network confirmation. It won’t count toward your balance until it’s credited.', noteCls: 'warn' },
  review: { label: 'Pending review', note: 'Awaiting review. Nothing has been signed or broadcast.', noteCls: 'warn' },
  failed: { label: 'Failed', note: 'This withdrawal failed and the amount was returned to your balance.', noteCls: 'error' },
};

const viewOf = (path: string): { view: View; assetId: string | null } => {
  const [first, second] = path.split('/').filter(Boolean);
  if (first === 'asset' && second) return { view: 'asset', assetId: decodeURIComponent(second) };
  if (first && first in PAGES) return { view: first as View, assetId: null };
  return { view: 'overview', assetId: null };
};
const chg = (bps: number) => ({ cls: bps > 0 ? 'up' : bps < 0 ? 'down' : 'flat', up: bps > 0, down: bps < 0, text: `${(Math.abs(bps) / 100).toFixed(2)}%` });
const freshSend = (asset: string): SendState => ({
  step: 1,
  asset,
  amount: '',
  address: '',
  tag: '',
  code: '',
  confirm: false,
  tried1: false,
  tried2: false,
  tried3: false,
  ref: '',
  error: '',
  busy: false,
  key: crypto.randomUUID(),
});

/** All view state and handlers for the dashboard markup (port of Main.dc.html's renderVals). */
export const useDashboard = (source: DashboardSource, accent = '#0A0A0A') => {
  const router = useRouter();
  const { view, assetId } = viewOf(usePathname());
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [period, setPeriod] = useState<PeriodId>('1M');
  const [points, setPoints] = useState<SeriesPoint[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [menu, setMenu] = useState<'notif' | 'profile' | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [recvAsset, setRecvAsset] = useState('XRP');
  const [deposit, setDeposit] = useState<DepositInfo | null>(null);
  const [copied, setCopied] = useState<'addr' | 'tag' | null>(null);
  const [send, setSend] = useState<SendState>(() => freshSend('XRP'));
  const [buy, setBuy] = useState({ asset: 'XRP', amount: '' });
  const [filter, setFilter] = useState<'all' | 'receive' | 'send' | 'exchange'>('all');
  const [unread, setUnread] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const dialogEl = useRef<HTMLElement | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const timers = useRef<{ toast?: ReturnType<typeof setTimeout>; copy?: ReturnType<typeof setTimeout> }>({});

  const reload = useCallback(() => {
    setLoadState('loading');
    source
      .load()
      .then((s) => {
        setSnap(s);
        setLoadState('ready');
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.message === 'unauthenticated') router.replace('/sign-in');
        else setLoadState('error');
      });
  }, [source, router]);
  useEffect(reload, [reload]);
  useEffect(() => {
    let live = true;
    source.series(view === 'asset' ? assetId : null, period).then(
      (p) => live && setPoints(p),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [source, view, assetId, period]);
  useEffect(() => {
    if (modal !== 'receive') return;
    setDeposit(null);
    source.deposit(recvAsset).then(setDeposit, () => setDeposit(null));
  }, [source, modal, recvAsset]);
  useEffect(() => {
    if (modal) dialogEl.current?.focus();
    else lastTrigger.current?.focus?.();
  }, [modal]);
  useEffect(() => {
    const t = timers.current;
    return () => {
      if (t.toast) clearTimeout(t.toast);
      if (t.copy) clearTimeout(t.copy);
    };
  }, []);

  const showToast = (msg: string) => {
    if (timers.current.toast) clearTimeout(timers.current.toast);
    setToast(msg);
    timers.current.toast = setTimeout(() => setToast(null), 3000);
  };
  const go = (v: View, id?: string) => {
    setMenu(null);
    setModal(null);
    router.push(v === 'overview' ? '/' : v === 'asset' ? `/asset/${encodeURIComponent(id ?? '')}` : `/${v}`);
  };
  const openModal = (name: Modal, extra?: () => void) => {
    lastTrigger.current = document.activeElement as HTMLElement | null;
    setMenu(null);
    extra?.();
    setModal(name);
  };
  const copy = (text: string, which: 'addr' | 'tag') => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    if (timers.current.copy) clearTimeout(timers.current.copy);
    setCopied(which);
    timers.current.copy = setTimeout(() => setCopied(null), 1800);
  };
  const patchSend = (p: Partial<SendState>) => setSend((s) => ({ ...s, ...p }));

  const assets = snap?.assets ?? [];
  const held = assets.filter((a) => a.held && a.units > 0n);
  const find = (id: string): Asset | undefined => assets.find((a) => a.id === id);
  const empty = loadState === 'ready' && held.length === 0 && (snap?.txs.length ?? 0) === 0;
  const cur = view === 'asset' && assetId ? find(assetId) : undefined;
  const p = PERIODS[period];
  const suffixOf = (id: PeriodId) => (id === 'ALL' ? (snap?.allTimeSuffix ?? PERIODS.ALL.suffix) : PERIODS[id].suffix);

  // Portfolio
  const pfCents = snap?.portfolioCents ?? 0n;
  // The chart series is real price history, so once it loads it gives the change for any period.
  const seriesChange = (): { first: number; last: number } | null =>
    points.length > 1 ? { first: points[0]?.v ?? 0, last: points[points.length - 1]?.v ?? 0 } : null;
  const sc = view !== 'asset' ? seriesChange() : null;
  const pfChange = sc ? BigInt(Math.round((sc.last - sc.first) * 100)) : (snap?.portfolioChangeCents[period] ?? 0n);
  const pfText = usdCents(pfCents);
  const startCents = pfCents - pfChange;
  const pfPct = startCents === 0n ? 0 : Number((pfChange * 1_000_000n) / startCents) / 10_000;
  const pf = {
    whole: empty ? '$0' : pfText.split('.')[0],
    cents: empty ? '.00' : `.${pfText.split('.')[1]}`,
    chgCls: empty ? 'flat' : pfChange >= 0n ? 'up' : 'down',
    up: !empty && pfChange > 0n,
    down: !empty && pfChange < 0n,
    chgText: empty ? '$0.00' : `${pfChange >= 0n ? '+' : '−'}${usdCents(pfChange < 0n ? -pfChange : pfChange)} (${Math.abs(pfPct).toFixed(2)}%)`,
    suffix: empty ? 'No deposits yet' : suffixOf(period),
  };

  const txView = (t: Tx) => {
    const st = STATUS[t.status];
    const a = find(t.asset);
    return {
      ...t,
      isReceive: t.kind === 'receive',
      isSend: t.kind === 'send',
      isExchange: t.kind === 'exchange',
      isBuy: t.kind === 'buy',
      amountColor: t.amount.startsWith('+') ? '#13704C' : '#17211D',
      statusCls: t.status,
      statusLabel: st.label,
      note: st.note,
      noteCls: st.noteCls,
      typeLabel: { receive: 'Deposit', send: 'Withdrawal', exchange: 'Exchange', buy: 'Purchase' }[t.kind],
      network: t.kind === 'exchange' || t.kind === 'buy' ? 'Internal' : (a?.network ?? ''),
      partyLabel: t.kind === 'receive' ? 'From' : t.kind === 'send' ? 'To' : 'Via',
      secondary: t.secondary ?? '',
      ledgerText: t.ledger ? `Ledger ${t.ledger}` : 'Not on a ledger yet',
      aria: `${t.title}, ${t.amount}, ${t.date}, ${st.label}`,
      open: () => openModal('tx', () => setTxId(t.id)),
    };
  };
  const allTxs = (snap?.txs ?? []).map(txView);
  const filteredTxs = allTxs.filter((t) => filter === 'all' || t.kind === filter || (filter === 'receive' && t.kind === 'buy'));

  const holdings = held.map((a) => {
    const c = chg(a.changeBps);
    const qty = `${formatUnits(a.units, a.scale, a.decimals)} ${a.ticker}`;
    const value = usdOf(a.units, a.scale, a.priceMicro);
    return {
      name: a.name,
      ticker: a.ticker,
      glyph: a.glyph,
      color: a.color,
      qtyText: qty,
      valueText: value,
      priceText: priceText(a.priceMicro),
      chgCls: c.cls,
      up: c.up,
      down: c.down,
      chgText: c.text,
      aria: `${a.name}, ${qty}, worth ${value}, ${a.changeBps >= 0 ? 'up ' : 'down '}${c.text} today`,
      open: () => go('asset', a.id),
    };
  });

  const asset = cur
    ? (() => {
        const ac = seriesChange();
        const pc = ac && ac.first ? Math.round(((ac.last - ac.first) / ac.first) * 10_000) : cur.periodChangeBps[period];
        const c = chg(cur.changeBps);
        const txs = allTxs.filter((t) => t.asset === cur.id);
        const valueCents = centsOf(cur.units, cur.scale, cur.priceMicro);
        return {
          name: cur.name,
          ticker: cur.ticker,
          glyph: cur.glyph,
          color: cur.color,
          network: cur.network,
          priceText: priceText(cur.priceMicro),
          periodCls: pc >= 0 ? 'up' : 'down',
          periodText: `${pc >= 0 ? '+' : '−'}${(Math.abs(pc) / 100).toFixed(2)}%`,
          periodSuffix: suffixOf(period),
          qtyText: `${formatUnits(cur.units, cur.scale, cur.decimals)} ${cur.ticker}`,
          valueText: usdCents(valueCents),
          chgCls: c.cls,
          chgText: `${cur.changeBps >= 0 ? '+' : '−'}${c.text}`,
          shareText: pfCents === 0n ? '0.0%' : `${(Number((valueCents * 1000n) / pfCents) / 10).toFixed(1)}%`,
          txs,
          noTxs: txs.length === 0,
          canSend: cur.held && cur.units > 0n,
          receive: () => openModal('receive', () => setRecvAsset(cur.id)),
          send: () => openModal('send', () => setSend(freshSend(cur.id))),
        };
      })()
    : null;

  const markets = assets.map((m) => {
    const c = chg(m.changeBps);
    const isHeld = m.held && m.units > 0n;
    // Every supported asset opens its page (price chart, receive); only held ones show a balance.
    return {
      name: m.name,
      ticker: m.ticker,
      glyph: m.glyph,
      color: m.color,
      held: m.held,
      notHeld: !m.held,
      priceText: priceText(m.priceMicro),
      chgCls: c.cls,
      chgText: `${m.changeBps >= 0 ? '+' : '−'}${c.text}`,
      holdText: isHeld ? formatUnits(m.units, m.scale, m.decimals) : '',
      aria: `${m.name}, ${priceText(m.priceMicro)}. View details`,
      open: () => go('asset', m.id),
    };
  });

  const sec = snap?.security ?? { twofa: false, allowlist: false, allowlistCount: 0, lastSignIn: '', passwordChanged: '' };
  const notif = snap?.notifications ?? { receipts: false, alerts: false };
  const security = [
    {
      label: 'Two-factor authentication',
      value: sec.twofa ? 'On · authenticator app' : 'Off — turn on to protect withdrawals',
      ok: sec.twofa,
      warn: !sec.twofa,
      neutral: false,
    },
    {
      label: 'Withdrawal allowlist',
      value: sec.allowlist ? `On · ${sec.allowlistCount} saved address${sec.allowlistCount === 1 ? '' : 'es'}` : 'Off · any address allowed',
      ok: sec.allowlist,
      warn: !sec.allowlist,
      neutral: false,
    },
    { label: 'Identity verification', value: snap?.verified ? 'Verified' : 'Not verified yet', ok: !!snap?.verified, warn: !snap?.verified, neutral: false },
    { label: 'Last sign-in', value: sec.lastSignIn, ok: false, warn: false, neutral: true },
  ];
  const patchSnap = (fn: (s: Snapshot) => Snapshot) => setSnap((s) => (s ? fn(s) : s));
  const toggleSecurity = (key: 'twofa' | 'allowlist') => async () => {
    const next = !sec[key];
    const r = await source.setSecurity(key, next);
    if (!r.ok) return showToast(r.error);
    patchSnap((s) => ({ ...s, security: { ...s.security, [key]: next } }));
    if (r.message) showToast(r.message);
  };
  const toggleNotification = (key: 'receipts' | 'alerts') => async () => {
    const next = !notif[key];
    const r = await source.setNotification(key, next);
    if (!r.ok) return showToast(r.error);
    patchSnap((s) => ({ ...s, notifications: { ...s.notifications, [key]: next } }));
  };

  const sendable = held;
  const picker = (current: string, list: Asset[], onPick: (id: string) => void) =>
    list.map((a) => ({ ticker: a.ticker, on: a.id === current, cls: a.id === current ? 'is-on' : '', pick: () => onPick(a.id) }));

  // Receive
  const ra = find(recvAsset);
  const recv = {
    name: ra?.name ?? '',
    ticker: ra?.ticker ?? '',
    network: deposit?.network ?? ra?.network ?? '',
    addr: deposit?.address ?? '…',
    usesTag: !!ra?.usesTag,
    tagLabel: ra?.memoKind === 'memo' ? 'Memo' : 'Destination tag',
    reported: deposit?.mode === 'reported',
    open: deposit?.open !== false,
    tag: deposit?.tag ?? '',
    real: !!deposit?.real,
    qrValue: deposit ? (deposit.tag ? `${deposit.address}?dt=${deposit.tag}` : deposit.address) : '',
    copyAddrLabel: copied === 'addr' ? 'Copied' : 'Copy address',
    copyTagLabel: copied === 'tag' ? 'Copied' : 'Copy',
  };

  // Send
  const sa = find(send.asset) ?? held[0];
  const scale = sa?.scale ?? 6;
  const dec = sa?.decimals ?? 2;
  const units = parseUnits(send.amount, scale);
  const fee = sa?.feeUnits ?? 0n;
  const avail = sa?.units ?? 0n;
  const maxUnits = source.feesDeducted ? avail : avail > fee ? avail - fee : 0n;
  let amountErr = '';
  if (send.amount !== '' && (units === null || units <= 0n)) amountErr = 'Enter an amount greater than zero.';
  else if (units !== null && units > maxUnits)
    amountErr = source.feesDeducted
      ? 'That’s more than your available balance.'
      : `Amount plus the ${formatUnits(fee, scale, dec)} ${sa?.ticker} network fee is more than your available balance.`;
  else if (source.feesDeducted && units !== null && units > 0n && units <= fee)
    amountErr = `The amount must be more than the ${formatUnits(fee, scale, dec)} ${sa?.ticker} fee.`;
  else if (send.amount === '' && send.tried1) amountErr = 'Enter an amount to send.';
  const step1Ok = units !== null && units > 0n && units <= maxUnits && !(source.feesDeducted && units <= fee);
  const addr = send.address.trim();
  let addrErr = '';
  if (send.tried2 && addr.length === 0) addrErr = `Enter the ${sa?.network} address you’re sending to.`;
  const addrValid = sa && isAssetId(sa.id) ? isAssetAddress(sa.id, addr) : addr.length >= 25 && !/\s/.test(addr);
  if (send.tried2 && addr.length > 0 && !addrValid) addrErr = `This isn’t a valid ${sa?.network} address. Check you copied all of it, for the right network.`;
  const tagErr =
    sa?.usesTag && sa.memoKind !== 'memo' && send.tag !== '' && !/^\d{1,10}$/.test(send.tag) ? 'Destination tags are numbers only, up to 10 digits.' : '';
  const step2Ok = addrValid && !tagErr;
  const receives = units === null ? 0n : source.feesDeducted ? units - fee : units;
  const fiat = (u: bigint) => (sa ? usdOf(u, sa.scale, sa.priceMicro) : '$0.00');
  const stepLabels = ['Amount', 'Destination', 'Review'];
  const codeErr = send.tried3 && source.needsTotp && !/^\d{6}$/.test(send.code) ? 'Enter the 6-digit code from your authenticator app.' : '';
  const sendVals = {
    title: send.step === 4 ? 'Withdrawal requested' : `Send ${sa?.name ?? ''}`,
    subtitle: send.step === 4 ? 'Your request is in the review queue' : `Step ${send.step} of 3 · ${stepLabels[send.step - 1]}`,
    showSteps: send.step < 4,
    steps: stepLabels.map((l, i) => ({
      label: l,
      cls: i + 1 < send.step ? 'done' : i + 1 === send.step ? 'current' : '',
      cur: i + 1 === send.step ? ('step' as const) : undefined,
    })),
    s1: send.step === 1,
    s2: send.step === 2,
    s3: send.step === 3,
    s4: send.step === 4,
    ticker: sa?.ticker ?? '',
    network: sa?.network ?? '',
    usesTag: !!sa?.usesTag,
    tagLabel: sa?.memoKind === 'memo' ? 'Memo' : 'Destination tag',
    amount: send.amount,
    address: send.address,
    tag: send.tag,
    code: send.code,
    confirm: send.confirm,
    needsTotp: source.needsTotp,
    busy: send.busy,
    amountCls: amountErr ? 'invalid' : '',
    addrCls: addrErr ? 'invalid' : '',
    tagCls: tagErr ? 'invalid' : '',
    codeCls: codeErr ? 'invalid' : '',
    amountErr,
    addrErr,
    tagErr,
    codeErr,
    confirmErr: send.error || (send.tried3 && !send.confirm ? 'Confirm you’ve checked the details to continue.' : ''),
    addrPlaceholder: `${sa?.placeholder ?? ''} ${sa?.network ?? ''} address`,
    fiatText: step1Ok && units !== null ? `≈ ${fiat(units)}` : '≈ $0.00',
    availText: `${formatUnits(avail, scale, dec)} ${sa?.ticker ?? ''}`,
    amountText: step1Ok && units !== null ? `${formatUnits(units, scale, dec)} ${sa?.ticker}` : '—',
    receivesText: step1Ok ? `${source.feesDeducted ? formatUnitsPrecise(receives, scale, dec) : formatUnits(receives, scale, dec)} ${sa?.ticker}` : '—',
    feeLabel: source.feesDeducted ? 'Fees (taken from the amount)' : 'Network fee',
    feeText: `${source.feesDeducted ? formatUnitsPrecise(fee, scale, dec) : formatUnits(fee, scale, dec)} ${sa?.ticker ?? ''} (${fiat(fee)})`,
    totalText: step1Ok && units !== null ? `${formatUnits(source.feesDeducted ? units : units + fee, scale, dec)} ${sa?.ticker}` : '—',
    tagText: send.tag || 'None',
    tagClause: sa?.usesTag ? (sa.memoKind === 'memo' ? ', memo' : ', destination tag') : '',
    ref: send.ref,
    showBack: send.step === 2 || send.step === 3,
    nextLabel: send.step === 3 ? 'Submit withdrawal request' : send.step === 4 ? 'Done' : 'Continue',
  };

  const submitSend = async () => {
    if (!sa || units === null) return;
    if (!send.confirm || (source.needsTotp && !/^\d{6}$/.test(send.code))) return patchSend({ tried3: true });
    patchSend({ busy: true, error: '' });
    const r = await source.withdraw({
      assetId: sa.id,
      units,
      destination: addr,
      tag: send.tag || null,
      totpCode: source.needsTotp ? send.code : null,
      idempotencyKey: send.key,
    });
    if (!r.ok) return patchSend({ busy: false, error: r.error });
    patchSnap((s) => ({ ...s, txs: [r.value.tx, ...s.txs] }));
    patchSend({ busy: false, step: 4, ref: r.value.ref });
  };

  // Buy
  const ba = find(buy.asset);
  const buyCents = parseUnits(buy.amount, 2);
  const buyVals = {
    amount: buy.amount,
    estimate:
      buyCents && buyCents > 0n && ba
        ? `≈ ${formatUnits((buyCents * 10n ** BigInt(ba.scale + 4)) / ba.priceMicro, ba.scale, ba.decimals + 2)} ${ba.ticker} at an indicative ${priceText(ba.priceMicro)}`
        : 'Enter an amount to see an estimate',
  };

  const txSel = allTxs.find((t) => t.id === txId) ?? null;
  const nav = Object.fromEntries(
    (['overview', 'activity', 'markets', 'earn', 'help', 'settings'] as const).flatMap((k) => {
      const on = view === k || (k === 'overview' && view === 'asset');
      return [
        [k, on ? 'is-active' : ''],
        [`${k}Cur`, on ? ('page' as const) : undefined],
      ];
    }),
  ) as Record<'overview' | 'activity' | 'markets' | 'earn' | 'help' | 'settings', string> &
    Record<'overviewCur' | 'activityCur' | 'marketsCur' | 'earnCur' | 'helpCur' | 'settingsCur', 'page' | undefined>;

  const page =
    view === 'asset' && cur
      ? { title: cur.name, sub: `${cur.ticker} · ${cur.network}` }
      : { title: PAGES[view === 'asset' ? 'overview' : view][0], sub: PAGES[view === 'asset' ? 'overview' : view][1] };
  const live = loadState === 'ready' && !empty;

  return {
    accent,
    demo: source.mode === 'demo',
    canBuy: source.canBuy,
    nav,
    page,
    profile: {
      name: snap?.displayName ?? '',
      initials: snap?.initials ?? '',
      email: snap?.email ?? '',
      verified: !!snap?.verified,
      currency: snap?.displayCurrency ?? 'USD',
    },
    isOverview: view === 'overview',
    isActivity: view === 'activity',
    isMarkets: view === 'markets',
    isEarn: view === 'earn',
    isSettings: view === 'settings',
    isHelp: view === 'help',
    isAsset: view === 'asset' && !!cur,
    state: { live, loading: loadState === 'loading', notLoading: loadState !== 'loading', empty, error: loadState === 'error', hasChart: live, hasData: live },
    skeletonRows: [1, 2, 3],
    pf,
    periods: PERIOD_IDS.map((id) => ({ id, on: id === period, cls: id === period ? 'is-on' : '', pick: () => setPeriod(id) })),
    chart: { points },
    holdings,
    recentTxs: allTxs.slice(0, 4),
    filters: (
      [
        ['all', 'All'],
        ['receive', 'Received'],
        ['send', 'Sent'],
        ['exchange', 'Exchanges'],
      ] as const
    ).map(([k, label]) => ({ label, on: filter === k, cls: filter === k ? 'is-on' : '', pick: () => setFilter(k) })),
    filteredTxs,
    noFilteredTxs: filteredTxs.length === 0,
    asset: asset ?? {
      name: '',
      ticker: '',
      glyph: '',
      color: '',
      network: '',
      priceText: '',
      periodCls: '',
      periodText: '',
      periodSuffix: '',
      qtyText: '',
      valueText: '',
      chgCls: '',
      chgText: '',
      shareText: '',
      txs: [],
      noTxs: true,
      canSend: false,
      receive: () => undefined,
      send: () => undefined,
    },
    markets,
    security,
    st: {
      twofa: sec.twofa,
      allowlist: sec.allowlist,
      receipts: notif.receipts,
      alerts: notif.alerts,
      twofaCls: sec.twofa ? 'is-on' : '',
      allowCls: sec.allowlist ? 'is-on' : '',
      receiptsCls: notif.receipts ? 'is-on' : '',
      alertsCls: notif.alerts ? 'is-on' : '',
      passwordChanged: sec.passwordChanged,
    },
    guides: GUIDES.map((g) => ({ title: g.title, body: g.body, open: guide === g.id, toggle: () => setGuide((x) => (x === g.id ? null : g.id)) })),
    menu: { notif: menu === 'notif', profile: menu === 'profile' },
    hasUnread: unread && (snap?.notices.length ?? 0) > 0,
    notifLabel: unread && snap?.notices.length ? `Notifications, ${snap.notices.length} unread` : 'Notifications',
    notifications: (snap?.notices ?? []).map((n) => ({
      text: n.text,
      time: n.time,
      dot: !unread ? '#D2D9D4' : n.tone === 'warn' ? '#D49711' : 'var(--accent)',
    })),
    modalOpen: modal !== null,
    dialogCls: modal === 'tx' ? 'is-drawer' : '',
    m: { receive: modal === 'receive', send: modal === 'send', buy: modal === 'buy', tx: modal === 'tx' && !!txSel },
    recv,
    recvAssets: picker(recvAsset, held.length ? held : assets.filter((a) => a.held), (id) => {
      setRecvAsset(id);
      setCopied(null);
    }),
    send: sendVals,
    sendAssets: picker(send.asset, sendable, (id) => setSend(freshSend(id))),
    buy: buyVals,
    buyAssets: picker(buy.asset, held, (id) => setBuy((b) => ({ ...b, asset: id }))),
    tx:
      txSel ??
      txView({ id: '', kind: 'receive', asset: '', title: '', date: '', amount: '', fiat: '', status: 'completed', party: '', fee: '', ref: '', ledger: null }),
    toast,

    goOverview: () => go('overview'),
    goActivity: () => go('activity'),
    goMarkets: () => go('markets'),
    goEarn: () => go('earn'),
    goHelp: () => go('help'),
    goSettings: () => go('settings'),
    openTagGuide: () => {
      setGuide('tag');
      go('help');
    },
    toggleNotif: () => setMenu((m) => (m === 'notif' ? null : 'notif')),
    toggleProfile: () => setMenu((m) => (m === 'profile' ? null : 'profile')),
    closeMenus: () => setMenu(null),
    onMenuKey: (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null),
    markRead: () => {
      setUnread(false);
      void source.markRead();
    },
    signOut: async () => {
      setMenu(null);
      const r = await source.signOut();
      if (!r.ok) showToast(r.error);
      else router.replace('/sign-in');
    },
    retry: reload,
    changePassword: async () => {
      const r = await source.changePassword();
      showToast(r.ok ? (r.message ?? 'Check your email to set a new password.') : r.error);
    },
    contactSupport: async () => {
      const r = await source.contactSupport();
      showToast(r.ok ? (r.message ?? 'Message sent.') : r.error);
    },
    toggleTwofa: toggleSecurity('twofa'),
    toggleAllow: toggleSecurity('allowlist'),
    toggleReceipts: toggleNotification('receipts'),
    toggleAlerts: toggleNotification('alerts'),

    openReceive: () => openModal('receive', () => setRecvAsset(held[0]?.id ?? 'XRP')),
    openSend: () => openModal('send', () => setSend(freshSend(sendable[0]?.id ?? 'XRP'))),
    openBuy: () => openModal('buy', () => setBuy({ asset: 'XRP', amount: '' })),
    closeModal: () => setModal(null),
    onModalKey: (e: KeyboardEvent) => e.key === 'Escape' && setModal(null),
    setDialog: (el: HTMLElement | null) => {
      dialogEl.current = el;
    },
    copyAddr: () => copy(recv.addr, 'addr'),
    copyTag: () => copy(recv.tag, 'tag'),

    onAmount: (e: ChangeEvent<HTMLInputElement>) => patchSend({ amount: e.target.value.replace(/[^0-9.,]/g, ''), error: '' }),
    setMax: () => patchSend({ amount: formatUnits(maxUnits - (maxUnits % 10n ** BigInt(Math.max(0, scale - dec))), scale, dec).replace(/,/g, '') }),
    onAddress: (e: ChangeEvent<HTMLInputElement>) => patchSend({ address: e.target.value, error: '' }),
    onTag: (e: ChangeEvent<HTMLInputElement>) => patchSend({ tag: e.target.value.replace(/\s/g, ''), error: '' }),
    onCode: (e: ChangeEvent<HTMLInputElement>) => patchSend({ code: e.target.value.replace(/\D/g, '').slice(0, 6), error: '' }),
    toggleConfirm: () => patchSend({ confirm: !send.confirm, error: '' }),
    sendBack: () => patchSend({ step: Math.max(1, send.step - 1) as SendState['step'], error: '' }),
    sendNext: () => {
      if (send.step === 1) return step1Ok ? patchSend({ step: 2 }) : patchSend({ tried1: true });
      if (send.step === 2) return step2Ok ? patchSend({ step: 3 }) : patchSend({ tried2: true });
      if (send.step === 3) return void submitSend();
      setModal(null);
    },
    viewActivity: () => {
      setModal(null);
      setFilter('all');
      go('activity');
    },
    onBuyAmount: (e: ChangeEvent<HTMLInputElement>) => setBuy((b) => ({ ...b, amount: e.target.value.replace(/[^0-9.,]/g, '') })),
    reviewBuy: () => {
      setModal(null);
      showToast('Purchases aren’t available yet — no order was placed.');
    },
  };
};

export type Vals = ReturnType<typeof useDashboard>;
