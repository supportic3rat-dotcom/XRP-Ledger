import { formatAmount, formatUsd } from '@xrp/ledger';
import type { Tone } from './types';

/** Staff-facing labels for transaction kinds and statuses (design: Transactions view). */
export const kindLabel = (kind: string, status: string, meta: Record<string, unknown>, asset = 'XRP', counterAsset: string | null = null): string => {
  switch (kind) {
    case 'deposit':
      if (status === 'no_tag' || meta.via_suspense) return 'Deposit (no tag)';
      return meta.reported_by ? `Deposit · ${asset} (reported)` : `Deposit · ${asset}`;
    case 'withdrawal':
      return `Withdrawal · ${asset}`;
    case 'exchange':
      return counterAsset ? `Swap · ${asset} → ${counterAsset}` : `Exchange · ${asset} → USD`;
    case 'yield_allocate':
      return 'Yield allocation';
    case 'yield_redeem':
      return 'Yield redemption';
    case 'yield_reward':
      return 'Yield reward';
    case 'loan':
      return status === 'applied' || status === 'approved' ? 'Loan application' : 'Loan funding';
    case 'loan_repay':
      return 'Loan repayment';
    case 'loan_collateral':
      return 'Collateral top-up';
    default:
      return kind;
  }
};

export const queueKind = (kind: string): 'withdrawal' | 'deposit' | 'exchange' | 'loan' | 'yield' =>
  kind === 'deposit' ? 'deposit' : kind === 'exchange' ? 'exchange' : kind === 'loan' ? 'loan' : kind.startsWith('yield') ? 'yield' : 'withdrawal';

export const txFilterKind = (kind: string): 'deposit' | 'withdrawal' | 'exchange' | 'yield' | 'loan' =>
  kind === 'deposit' ? 'deposit' : kind === 'withdrawal' ? 'withdrawal' : kind === 'exchange' ? 'exchange' : kind.startsWith('yield') ? 'yield' : 'loan';

/** Status wording and tone. "Completed" / "Credited" only after validation or provider confirmation. */
export const statusLabel = (kind: string, status: string): [string, Tone] => {
  const map: Record<string, [string, Tone]> = {
    'deposit:detected': ['Validating', 'wait'],
    'deposit:validated': ['Validating', 'wait'],
    'deposit:screened': ['Screening', 'wait'],
    'deposit:screening_hold': ['Screening hold', 'bad'],
    'deposit:no_tag': ['Exception', 'bad'],
    'deposit:credited': ['Credited', 'ok'],
    'deposit:reported': ['Confirming', 'wait'],
    'withdrawal:requested': ['Awaiting approval', 'wait'],
    'withdrawal:in_review': ['Awaiting approval', 'wait'],
    'withdrawal:approved': ['Approved', 'wait'],
    'withdrawal:submitted': ['Submitted', 'wait'],
    'withdrawal:validated': ['Completed', 'ok'],
    'exchange:requested': ['Awaiting review', 'wait'],
    'exchange:quote_requested': ['Quote requested', 'wait'],
    'exchange:quoted': ['Quoted', 'wait'],
    'exchange:quote_expired': ['Quote expired', 'off'],
    'exchange:accepted': ['Accepted', 'wait'],
    'exchange:sold': ['Sold', 'wait'],
    'exchange:paid_out': ['Paid out', 'ok'],
    'yield_allocate:requested': ['Awaiting review', 'wait'],
    'yield_allocate:sent': ['Allocating', 'wait'],
    'yield_allocate:confirmed': ['Allocated', 'ok'],
    'yield_redeem:requested': ['Awaiting review', 'wait'],
    'yield_redeem:sent': ['Redeeming', 'wait'],
    'yield_redeem:confirmed': ['Redeemed', 'ok'],
    'yield_reward:credited': ['Credited', 'ok'],
    'yield_reward:mismatch': ['Mismatch', 'bad'],
    'loan:applied': ['Awaiting review', 'wait'],
    'loan:approved': ['Approved', 'wait'],
    'loan:collateral_locked': ['To pay out', 'wait'],
    'loan:funded': ['Funded', 'ok'],
    'loan:active': ['Funded', 'ok'],
    'loan:margin_call': ['Margin call', 'bad'],
    'loan:liquidating': ['Liquidating', 'bad'],
    'loan:repaid': ['Repaid', 'ok'],
    'loan_repay:awaiting_payment': ['Awaiting transfer', 'wait'],
    'loan_repay:applied': ['Applied', 'ok'],
  };
  const hit = map[`${kind}:${status}`];
  if (hit) return hit;
  if (['rejected', 'failed', 'cancelled', 'provider_failed'].includes(status))
    return [status === 'cancelled' ? 'Cancelled' : status === 'rejected' ? 'Rejected' : 'Failed', 'bad'];
  return [status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), 'wait'];
};

const ACCOUNT_NAME: Record<string, string> = {
  available: 'Customer available',
  reserved: 'Customer reserved',
  pending_yield: 'Customer pending yield',
  yield: 'Customer yield',
  collateral: 'Customer collateral',
  omnibus: 'Custody omnibus',
  suspense: 'Unattributed deposits',
  fee_revenue: 'Fee revenue',
  provider_receivable: 'Yield provider receivable',
};
/** "Customer available · BTC" */
export const accountLabel = (kind: string, asset = 'XRP'): string => `${ACCOUNT_NAME[kind] ?? kind} · ${asset}`;

/** Amount label: "1,250.00 XRP", "−0.012500 BTC" (signed on the Transactions view), or "$1,500.00" for loans. */
export const amountLabel = (r: { kind: string; amount_drops: unknown; amount_cents: unknown; asset?: unknown }, signed: boolean): string => {
  if (r.kind === 'loan' || r.kind === 'loan_repay') return r.amount_cents === null ? '' : formatUsd(BigInt(String(r.amount_cents)));
  if (r.amount_drops === null) return r.amount_cents === null ? '' : formatUsd(BigInt(String(r.amount_cents)));
  const v = formatAmount(BigInt(String(r.amount_drops)), r.asset ? String(r.asset) : 'XRP');
  if (!signed) return v;
  if (r.kind === 'deposit' || r.kind === 'yield_reward') return `+${v}`;
  if (r.kind === 'withdrawal') return `−${v}`;
  return v;
};
