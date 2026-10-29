import { asset as assetSpec, formatAmount, formatAssetPrice, formatUnitsPrecise, formatUsd, shortAddress, unitsToCents } from '@xrp/ledger';
import type { IconName } from '@xrp/tokens';
import type { MicroUsd, Tone, Transaction, TxEvent } from '@xrp/types';
import { listDate, longWhen, md, mdhm, stepTime } from '@/lib/dates';

export type StepState = 'done' | 'now' | 'bad' | 'skip' | '';
export type TxStep = { label: string; at: string; state: StepState };
export type TxRow = { k: string; v: string; mono?: boolean };
export type BannerTone = 'info' | 'warn' | 'error';

export type TxView = {
  id: string;
  ref: string;
  /** Asset the amount is in (for the coin logo); `USD` for loan cash flows. */
  asset: string;
  icon: IconName;
  title: string;
  date: string;
  when: string;
  amount: string;
  fiat: string;
  status: string;
  tone: Tone;
  rows: TxRow[];
  steps: TxStep[];
  note: string;
  noteTone: BannerTone;
  aria: string;
};

/** `prices`: latest USD price per asset (micro-USD), for the fiat line. */
export type DescribeContext = {
  now: Date;
  prices: Record<string, MicroUsd>;
  connectedWallets: string[];
  /** Values in the customer's currency (USD when omitted). USD amounts the customer is actually paid stay in USD. */
  money?: (cents: bigint) => string;
  price?: (micro: MicroUsd) => string;
};

/** The bank account a USD sale or loan is paid to, as the customer entered it. */
const bankOf = (tx: Transaction): string => {
  const p = (tx.meta as Record<string, unknown>).payout as { bank?: string; account_number?: string } | undefined;
  return p?.bank ? `${p.bank} •••• ${String(p.account_number ?? '').slice(-4)}` : 'your bank account';
};
const priceOf = (ctx: DescribeContext, a: string): MicroUsd => ctx.prices[a] ?? 0n;
const usdOf = (units: bigint, a: string, ctx: DescribeContext): string => (ctx.money ?? formatUsd)(unitsToCents(units, priceOf(ctx, a), a));
const atPrice = (a: string, ctx: DescribeContext): string => (ctx.price ?? formatAssetPrice)(priceOf(ctx, a));
const network = (a: string): string => assetSpec(a).network;

const eventAt = (tx: Transaction, status: string): string | undefined => tx.events.find((e: TxEvent) => e.toStatus === status)?.at;
const reached = (tx: Transaction, statuses: readonly string[]): boolean => statuses.includes(tx.status as string);
const shortHash = (hash: string): string => (hash.length > 10 ? `${hash.slice(0, 4)}…${hash.slice(-5)}` : hash);

/** Builds a timeline where everything up to `currentIndex` is done and the current step is "now". */
const timeline = (labels: readonly { label: string; at?: string }[], currentIndex: number, tx: Transaction, complete: boolean): TxStep[] =>
  labels.map((s, i) => {
    const done = complete || i < currentIndex;
    return {
      label: s.label,
      at: done && s.at ? stepTime(s.at, tx.createdAt) : '',
      state: done ? 'done' : i === currentIndex ? 'now' : '',
    };
  });

const statusOf = (tx: Transaction): { status: string; tone: Tone } => {
  const s = tx.status as string;
  switch (tx.kind) {
    case 'deposit':
      if (s === 'credited') return { status: 'Credited', tone: 'ok' };
      if (s === 'screened' || s === 'screening_hold') return { status: 'Screening', tone: 'wait' };
      if (s === 'no_tag') return { status: 'Held', tone: 'wait' };
      if (s === 'reported') return { status: 'Confirming', tone: 'wait' };
      if (s === 'rejected') return { status: 'Not confirmed', tone: 'bad' };
      return { status: 'Validating', tone: 'wait' };
    case 'withdrawal':
      return (
        {
          requested: { status: 'Submitted', tone: 'wait' as Tone },
          in_review: { status: 'In review', tone: 'wait' as Tone },
          approved: { status: 'Approved', tone: 'wait' as Tone },
          submitted: { status: 'Sent', tone: 'wait' as Tone },
          validated: { status: 'Completed', tone: 'ok' as Tone },
          rejected: { status: 'Rejected', tone: 'bad' as Tone },
          failed: { status: 'Failed', tone: 'bad' as Tone },
          cancelled: { status: 'Cancelled', tone: 'off' as Tone },
        }[s] ?? { status: 'In review', tone: 'wait' }
      );
    case 'exchange':
      return (
        {
          requested: { status: 'Under review', tone: 'wait' as Tone },
          quote_requested: { status: 'Under review', tone: 'wait' as Tone },
          quoted: { status: 'Awaiting user action', tone: 'wait' as Tone },
          quote_expired: { status: 'Quote expired', tone: 'wait' as Tone },
          accepted: { status: 'Approved', tone: 'ok' as Tone },
          sold: { status: 'Processing', tone: 'wait' as Tone },
          paid_out: { status: 'Completed', tone: 'ok' as Tone },
          rejected: { status: 'Rejected', tone: 'bad' as Tone },
          cancelled: { status: 'Cancelled', tone: 'off' as Tone },
        }[s] ?? { status: 'Under review', tone: 'wait' }
      );
    case 'yield_reward':
      return s === 'credited' ? { status: 'Credited', tone: 'ok' } : { status: 'Pending', tone: 'wait' };
    case 'yield_allocate':
    case 'yield_redeem':
      return s === 'confirmed'
        ? { status: 'Confirmed', tone: 'ok' }
        : s === 'provider_failed'
          ? { status: 'Failed', tone: 'bad' }
          : { status: 'At provider', tone: 'wait' };
    case 'loan':
      return reached(tx, ['funded', 'active', 'repaid', 'margin_call', 'liquidating'])
        ? { status: 'Completed', tone: 'ok' }
        : s === 'rejected'
          ? { status: 'Rejected', tone: 'bad' }
          : { status: 'In review', tone: 'wait' };
    case 'loan_repay':
      return s === 'applied'
        ? { status: 'Completed', tone: 'ok' }
        : s === 'failed'
          ? { status: 'Failed', tone: 'bad' }
          : { status: 'In progress', tone: 'wait' };
    case 'loan_collateral':
      return s === 'ltv_updated'
        ? { status: 'Completed', tone: 'ok' }
        : s === 'failed'
          ? { status: 'Failed', tone: 'bad' }
          : { status: 'In progress', tone: 'wait' };
  }
};

const describeDeposit = (tx: Transaction, ctx: DescribeContext): Omit<TxView, 'status' | 'tone' | 'aria' | 'date' | 'when' | 'id' | 'ref' | 'asset'> => {
  const a = tx.asset;
  const amount = tx.amountDrops ?? 0n;
  const credited = tx.status === 'credited';
  const from = tx.counterparty ?? '';
  const own = ctx.connectedWallets.includes(from);
  const fiat = credited ? `≈ ${usdOf(amount, a, ctx)} at today’s price` : `≈ ${usdOf(amount, a, ctx)} at ${atPrice(a, ctx)}`;
  const hash = tx.ledgerHash ?? tx.meta.tx_hash ?? null;
  // Reported (non-XRP) deposits: the customer reports the transaction; staff confirm it on the network.
  if (tx.meta.reported_by || tx.status === 'reported' || tx.status === 'rejected') {
    const rejected = tx.status === 'rejected';
    return {
      icon: 'recv',
      title: `Deposit · ${a}`,
      amount: `+${formatAmount(amount, a)}`,
      fiat,
      rows: [
        { k: 'Type', v: 'Deposit' },
        { k: 'Network', v: network(a) },
        ...(from ? [{ k: 'From', v: shortAddress(from, 6, 8), mono: true }] : []),
        ...(hash ? [{ k: 'Transaction hash', v: shortHash(hash), mono: true }] : []),
        { k: 'Fee', v: 'None' },
        { k: 'Reference', v: tx.ref, mono: true },
      ],
      steps: rejected
        ? [
            { label: 'Reported', at: stepTime(tx.createdAt, tx.createdAt), state: 'done' },
            { label: 'Not confirmed on the network', at: stepTime(eventAt(tx, 'rejected') ?? tx.createdAt, tx.createdAt), state: 'bad' },
          ]
        : timeline(
            [
              { label: 'Reported by you', at: tx.createdAt },
              { label: `Confirmed on ${network(a)}`, at: eventAt(tx, 'validated') },
              { label: 'Compliance screening', at: eventAt(tx, 'screened') },
              { label: 'Credited to balance', at: eventAt(tx, 'credited') },
            ],
            { reported: 1, validated: 2, screened: 3, credited: 4 }[tx.status as string] ?? 1,
            tx,
            credited,
          ),
      note: credited
        ? 'Confirmed on the network by our team and credited.'
        : rejected
          ? 'We couldn’t find this transaction arriving at the platform address. Contact support with the hash if you think this is wrong.'
          : 'Not in your balance yet. Our team checks the transaction on the network, then credits it — usually within a few hours.',
      noteTone: credited ? 'info' : rejected ? 'error' : 'warn',
    };
  }
  const order = ['detected', 'validated', 'screened', 'credited'];
  const idx = Math.max(0, order.indexOf(tx.status === 'screening_hold' ? 'validated' : (tx.status as string)));
  return {
    icon: 'recv',
    title: `Deposit · ${a}`,
    amount: `+${formatAmount(amount, a)}`,
    fiat,
    rows: [
      { k: 'Type', v: 'Deposit' },
      { k: 'Network', v: network(a) },
      { k: 'From', v: own ? `${shortAddress(from, 4, 6)} (your connected wallet)` : shortAddress(from, 6, 8), mono: true },
      { k: 'Destination tag', v: tx.destinationTag ?? 'None', mono: true },
      { k: 'Fee', v: 'None' },
      {
        k: 'Ledger hash',
        v: tx.ledgerHash && credited ? shortHash(tx.ledgerHash) : 'Available after validation',
        ...(tx.ledgerHash && credited ? { mono: true } : {}),
      },
      { k: 'Reference', v: tx.ref, mono: true },
    ],
    steps: timeline(
      [
        { label: 'Detected on ledger', at: eventAt(tx, 'detected') },
        { label: 'Validated', at: eventAt(tx, 'validated') },
        { label: 'Compliance screening', at: eventAt(tx, 'screened') },
        { label: 'Credited to balance', at: eventAt(tx, 'credited') },
      ],
      credited ? 4 : idx + 1,
      tx,
      credited,
    ),
    note: credited
      ? 'Credited after validation and screening.'
      : 'Not in your available balance yet. It’s credited once the ledger validates it and screening passes.',
    noteTone: credited ? 'info' : 'warn',
  };
};

const describeWithdrawal = (tx: Transaction, ctx: DescribeContext): Omit<TxView, 'status' | 'tone' | 'aria' | 'date' | 'when' | 'id' | 'ref' | 'asset'> => {
  const a = tx.asset;
  /** Coins on the custody integration (`automatic`) are signed by the provider; the rest are sent by staff. */
  const auto = assetSpec(a).deposit === 'automatic';
  const xrp = a === 'XRP';
  const gross = tx.amountDrops ?? 0n;
  const fee = tx.platformFeeDrops ?? 0n;
  const net = tx.networkFeeDrops ?? 0n;
  const sent = gross;
  const validated = tx.status === 'validated';
  const at = (s: string) => eventAt(tx, s);
  const labels = [
    { label: 'Submitted', at: at('requested') },
    { label: 'Balance reserved', at: at('requested') },
    { label: 'Compliance review', at: at('approved') ? at('in_review') : undefined },
    { label: 'Approved', at: at('approved') },
    { label: auto ? 'Sent to custody provider' : 'Sent from platform wallet', at: at('submitted') },
    { label: auto ? 'Validated on ledger' : `Confirmed on ${network(a)}`, at: at('validated') },
    { label: 'Completed', at: at('validated') },
  ];
  const stage = { requested: 2, in_review: 2, approved: 4, submitted: 5, validated: 7 }[tx.status as string] ?? 2;
  const bad = ['rejected', 'failed', 'cancelled'].includes(tx.status as string);
  let steps = timeline(labels, stage, tx, validated);
  if (bad) steps = steps.map((s, i) => (i < 2 ? s : { ...s, state: 'skip', at: '' }));
  return {
    icon: 'send',
    title: `Withdrawal · ${a}`,
    amount: `−${formatAmount(sent, a)}`,
    fiat: `≈ ${usdOf(sent, a, ctx)} at ${atPrice(a, ctx)}`,
    rows: [
      { k: 'Type', v: 'Withdrawal' },
      { k: 'Network', v: network(a) },
      { k: 'To', v: shortAddress(tx.counterparty ?? '', 6, 8), mono: true },
      ...(xrp ? [{ k: 'Destination tag', v: tx.destinationTag ?? 'None', mono: true }] : []),
      ...(tx.meta.memo ? [{ k: 'Memo', v: tx.meta.memo, mono: true }] : []),
      { k: 'Platform fee', v: formatAmount(fee, a, { minDecimals: 2, maxDecimals: 8 }) },
      { k: 'Network fee', v: xrp ? `${formatUnitsPrecise(net, a)} XRP` : 'Paid by the platform' },
      ...(validated ? [{ k: 'Recipient received', v: `${formatUnitsPrecise(gross - fee - net, a)} ${a}` }] : []),
      ...(tx.ledgerHash ? [{ k: xrp ? 'Ledger hash' : 'Transaction hash', v: shortHash(tx.ledgerHash), mono: true }] : []),
      { k: 'Reference', v: tx.ref, mono: true },
    ],
    steps,
    note: validated
      ? `Completed only after the transaction was confirmed on the ${network(a)} network. It can’t be reversed.`
      : bad
        ? 'The reserved amount went back to your available balance.'
        : `Approval isn’t the same as sent. This shows Completed only after the transaction is confirmed on the ${network(a)} network.`,
    noteTone: 'info',
  };
};

const describeExchange = (tx: Transaction, ctx: DescribeContext): Omit<TxView, 'status' | 'tone' | 'aria' | 'date' | 'when' | 'id' | 'ref' | 'asset'> => {
  const a = tx.asset;
  const to = tx.counterAsset ?? null;
  const amount = tx.amountDrops ?? 0n;
  const rejected = tx.status === 'rejected';
  const indicative = tx.meta.indicative_cents ? BigInt(tx.meta.indicative_cents) : unitsToCents(amount, priceOf(ctx, a), a);
  const reviewedAt = tx.meta.reviewed_at ?? eventAt(tx, 'quote_requested');
  const steps: TxStep[] = rejected
    ? [
        { label: 'Submitted', at: stepTime(tx.createdAt, tx.createdAt), state: 'done' },
        { label: 'Under review', at: reviewedAt ? stepTime(reviewedAt, tx.createdAt) : '', state: 'done' },
        { label: 'Rejected', at: stepTime(eventAt(tx, 'rejected') ?? tx.createdAt, tx.createdAt), state: 'bad' },
      ]
    : timeline(
        [
          { label: 'Submitted', at: tx.createdAt },
          { label: 'Under review', at: reviewedAt },
          { label: 'Awaiting your acceptance', at: eventAt(tx, 'quoted') },
          { label: 'Approved', at: eventAt(tx, 'accepted') },
          { label: 'Processing', at: eventAt(tx, 'sold') },
          { label: 'Completed', at: eventAt(tx, 'paid_out') },
        ],
        { requested: 1, quote_requested: 1, quoted: 2, quote_expired: 2, accepted: 4, sold: 5, paid_out: 6 }[tx.status as string] ?? 1,
        tx,
        tx.status === 'paid_out',
      );
  return {
    icon: 'exchange',
    title: to ? `Swap · ${a} → ${to}` : `Exchange · ${a} → USD`,
    amount: `−${formatAmount(amount, a)}`,
    fiat: to && tx.counterAmount ? `Receive ${formatAmount(tx.counterAmount, to)}` : `Indicative ≈ ${formatUsd(indicative)}`,
    rows: [
      { k: 'Type', v: to ? 'Swap request' : 'Exchange request' },
      { k: to ? 'Swap' : 'Sell', v: formatAmount(amount, a) },
      { k: 'Receive', v: to ? (tx.counterAmount ? `${formatAmount(tx.counterAmount, to)} to your balance` : `${to} to your balance`) : `USD to ${bankOf(tx)}` },
      { k: 'Fees charged', v: rejected ? 'None' : 'Shown on the firm quote' },
      ...(tx.meta.reason ? [{ k: 'Reason', v: tx.meta.reason }] : []),
      { k: 'Reference', v: tx.ref, mono: true },
    ],
    steps,
    note: rejected
      ? `No ${a} was reserved because the quote was never accepted.${to ? '' : ' Verify your payout account, then submit a new request.'}`
      : `This isn’t instant. Your ${a} is reserved only after you accept a firm quote.`,
    noteTone: rejected ? 'error' : 'info',
  };
};

const describeYieldReward = (tx: Transaction, ctx: DescribeContext): Omit<TxView, 'status' | 'tone' | 'aria' | 'date' | 'when' | 'id' | 'ref' | 'asset'> => {
  const a = tx.asset;
  const gross = tx.amountDrops ?? 0n;
  const fee = tx.platformFeeDrops ?? 0n;
  const credited = tx.status === 'credited';
  const accrued = eventAt(tx, 'statement_received');
  const matched = eventAt(tx, 'matched');
  const done = eventAt(tx, 'credited');
  return {
    icon: 'plus',
    title: 'Yield reward',
    amount: `+${formatAmount(gross - fee, a)}`,
    fiat: `≈ ${usdOf(gross - fee, a, ctx)} at ${atPrice(a, ctx)}`,
    rows: [
      { k: 'Type', v: 'Yield payout' },
      { k: 'Product', v: tx.meta.product ?? `${a} Flexible` },
      { k: 'Provider', v: 'Earn' },
      ...(tx.meta.period ? [{ k: 'Period', v: tx.meta.period }] : []),
      { k: 'Gross reward', v: formatAmount(gross, a) },
      { k: 'Platform fee (10%)', v: formatAmount(fee, a) },
      { k: 'Reference', v: tx.ref, mono: true },
    ],
    steps: [
      { label: 'Accrued', at: accrued ? md(accrued) : '', state: 'done' },
      { label: 'Confirmed by provider', at: matched ? mdhm(matched) : '', state: matched ? 'done' : 'now' },
      { label: 'Credited to balance', at: done ? mdhm(done) : '', state: credited ? 'done' : matched ? 'now' : '' },
    ],
    note: 'Reward confirmed against the provider’s records before it was credited.',
    noteTone: 'info',
  };
};

const describeLoan = (tx: Transaction): Omit<TxView, 'status' | 'tone' | 'aria' | 'date' | 'when' | 'id' | 'ref' | 'asset'> => {
  const at = (s: string) => eventAt(tx, s);
  const funded = reached(tx, ['funded', 'active', 'repaid', 'margin_call', 'liquidating']);
  const stepAt = (iso: string | undefined, dateOnly = false) => (iso ? (dateOnly ? md(iso) : mdhm(iso)) : '');
  return {
    icon: 'borrow',
    title: funded ? 'Loan funded' : 'Loan application',
    amount: `+${formatUsd(tx.amountCents ?? 0n)}`,
    fiat: `Loan ${tx.ref}`,
    rows: [
      { k: 'Type', v: 'Loan disbursement' },
      { k: 'Provider', v: 'Borrow' },
      { k: 'Collateral locked', v: formatAmount(tx.amountDrops ?? 0n, tx.asset) },
      ...(tx.meta.starting_ltv ? [{ k: 'Starting LTV', v: tx.meta.starting_ltv }] : []),
      { k: 'Interest', v: tx.meta.interest ?? '10.00% APR · fixed' },
      ...(tx.meta.origination_fee ? [{ k: 'Origination fee', v: tx.meta.origination_fee }] : []),
      { k: 'Paid to', v: tx.meta.paid_to ?? bankOf(tx) },
      { k: 'Reference', v: tx.ref, mono: true },
    ],
    steps: [
      { label: 'Application submitted', at: stepAt(at('applied'), true), state: 'done' },
      { label: 'Provider approved', at: stepAt(at('approved')), state: at('approved') ? 'done' : 'now' },
      { label: 'Collateral locked', at: stepAt(at('collateral_locked')), state: at('collateral_locked') ? 'done' : at('approved') ? 'now' : '' },
      { label: 'Funds settled', at: stepAt(at('funded')), state: funded ? 'done' : at('collateral_locked') ? 'now' : '' },
    ],
    note: funded ? 'Funded after the provider confirmed settlement to your bank account.' : 'Nothing is funded until the provider settles.',
    noteTone: 'info',
  };
};

const describeOther = (tx: Transaction, ctx: DescribeContext): Omit<TxView, 'status' | 'tone' | 'aria' | 'date' | 'when' | 'id' | 'ref' | 'asset'> => {
  const a = tx.asset;
  const amount = tx.amountDrops ?? 0n;
  const titles: Record<string, string> = {
    yield_allocate: `Allocated to ${a} Flexible`,
    yield_redeem: `Withdrawn from ${a} Flexible`,
    loan_repay: 'Loan repayment',
    loan_collateral: 'Collateral top-up',
  };
  const isUsd = tx.kind === 'loan_repay';
  return {
    icon: tx.kind === 'loan_repay' || tx.kind === 'loan_collateral' ? 'borrow' : 'sprout',
    title: titles[tx.kind] ?? 'Transaction',
    amount: isUsd ? formatUsd(tx.amountCents ?? 0n) : formatAmount(amount, a),
    fiat: isUsd ? `Loan ${tx.meta.loan_ref ?? ''}` : `≈ ${usdOf(amount, a, ctx)} at ${atPrice(a, ctx)}`,
    rows: [
      { k: 'Type', v: titles[tx.kind] ?? tx.kind },
      { k: 'Provider', v: tx.kind.startsWith('yield') ? 'Earn' : 'Borrow' },
      { k: 'Reference', v: tx.ref, mono: true },
    ],
    steps: tx.events.map((e) => ({ label: e.note ?? String(e.toStatus), at: stepTime(e.at, tx.createdAt), state: 'done' as StepState })),
    note: 'Balances change only after the provider confirms.',
    noteTone: 'info',
  };
};

export const describeTx = (tx: Transaction, ctx: DescribeContext): TxView => {
  const base =
    tx.kind === 'deposit'
      ? describeDeposit(tx, ctx)
      : tx.kind === 'withdrawal'
        ? describeWithdrawal(tx, ctx)
        : tx.kind === 'exchange'
          ? describeExchange(tx, ctx)
          : tx.kind === 'yield_reward'
            ? describeYieldReward(tx, ctx)
            : tx.kind === 'loan'
              ? describeLoan(tx)
              : describeOther(tx, ctx);
  const { status, tone } = statusOf(tx);
  const date = listDate(tx.createdAt, ctx.now);
  return {
    ...base,
    id: tx.id,
    ref: tx.ref,
    asset: tx.kind === 'loan' || tx.kind === 'loan_repay' ? 'USD' : tx.asset,
    status,
    tone,
    date,
    when: longWhen(tx.createdAt),
    aria: `${base.title}, ${base.amount}, ${status}, ${date}. Show details`,
  };
};
