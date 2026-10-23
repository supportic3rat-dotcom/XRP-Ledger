import type { Drops, LedgerAccountKind, TxKind } from '@xrp/types';

export type JournalLine = { account: LedgerAccountKind; owner: 'customer' | 'platform'; amount: Drops };

/**
 * Journal lines posted at each step (signed: + debit, − credit). Mirrors `transition_tx()`.
 * Every returned set sums to zero.
 */
export const journalFor = (kind: TxKind, toStatus: string, amount: Drops, fee: Drops = 0n): JournalLine[] => {
  const c = (account: LedgerAccountKind, value: Drops): JournalLine => ({ account, owner: 'customer', amount: value });
  const p = (account: LedgerAccountKind, value: Drops): JournalLine => ({ account, owner: 'platform', amount: value });
  switch (`${kind}:${toStatus}`) {
    case 'deposit:credited':
      return [p('omnibus', amount), c('available', -amount)];
    case 'deposit:no_tag':
      return [p('omnibus', amount), p('suspense', -amount)];
    case 'withdrawal:requested':
      return [c('available', amount), c('reserved', -amount)];
    case 'withdrawal:validated':
      return [c('reserved', amount), p('omnibus', -(amount - fee)), p('fee_revenue', -fee)];
    case 'withdrawal:rejected':
    case 'withdrawal:failed':
    case 'withdrawal:cancelled':
      return [c('reserved', amount), c('available', -amount)];
    case 'exchange:accepted':
      return [c('available', amount), c('reserved', -amount)];
    case 'exchange:sold':
      return [c('reserved', amount), p('omnibus', -amount)];
    case 'yield_allocate:requested':
    case 'yield_redeem:confirmed':
      return kind === 'yield_allocate' ? [c('available', amount), c('pending_yield', -amount)] : [c('yield', amount), c('available', -amount)];
    case 'yield_allocate:confirmed':
      return [c('pending_yield', amount), c('yield', -amount)];
    case 'yield_allocate:provider_failed':
      return [c('pending_yield', amount), c('available', -amount)];
    case 'yield_reward:credited':
      return [p('provider_receivable', amount), c('available', -(amount - fee)), p('fee_revenue', -fee)];
    case 'loan:collateral_locked':
      return [c('available', amount), c('collateral', -amount)];
    case 'loan_collateral:recorded':
      return [c('available', amount), c('reserved', -amount)];
    case 'loan_collateral:lock_confirmed':
      return [c('reserved', amount), c('collateral', -amount)];
    case 'loan_collateral:failed':
      return [c('reserved', amount), c('available', -amount)];
    case 'yield_redeem:requested':
      return [];
    case 'loan:repaid':
      return [c('collateral', amount), c('available', -amount)];
    default:
      return [];
  }
};

export const isBalanced = (lines: readonly JournalLine[]): boolean => lines.reduce((sum, l) => sum + l.amount, 0n) === 0n;
