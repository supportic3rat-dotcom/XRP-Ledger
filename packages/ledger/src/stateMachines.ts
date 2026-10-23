import type { TxKind, TxStatusByKind } from '@xrp/types';

type Machine<K extends TxKind> = { initial: TxStatusByKind[K]; transitions: Record<TxStatusByKind[K], readonly TxStatusByKind[K][]> };

/** Allowed transitions per transaction kind. Mirrored in SQL by `tx_transitions` + `transition_tx()`. */
export const machines: { [K in TxKind]: Machine<K> } = {
  deposit: {
    initial: 'detected',
    transitions: {
      detected: ['validated', 'no_tag'],
      validated: ['screened', 'screening_hold'],
      screened: ['credited'],
      screening_hold: ['screened'],
      no_tag: ['validated'],
      credited: [],
      // Non-XRP deposits: reported by the customer, confirmed (or rejected) by staff.
      reported: ['validated', 'rejected'],
      rejected: [],
    },
  },
  withdrawal: {
    initial: 'requested',
    transitions: {
      requested: ['in_review', 'cancelled', 'rejected'],
      in_review: ['approved', 'rejected', 'cancelled'],
      approved: ['submitted', 'failed'],
      submitted: ['validated', 'failed'],
      validated: [],
      rejected: [],
      failed: [],
      cancelled: [],
    },
  },
  exchange: {
    initial: 'requested',
    transitions: {
      requested: ['quote_requested', 'rejected', 'cancelled'],
      quote_requested: ['quoted', 'rejected', 'cancelled'],
      quoted: ['accepted', 'quote_expired', 'cancelled'],
      quote_expired: ['quote_requested', 'cancelled'],
      accepted: ['sold'],
      sold: ['paid_out'],
      paid_out: [],
      rejected: [],
      cancelled: [],
    },
  },
  yield_allocate: {
    initial: 'requested',
    transitions: { requested: ['sent', 'provider_failed'], sent: ['confirmed', 'provider_failed'], confirmed: [], provider_failed: [] },
  },
  yield_redeem: {
    initial: 'requested',
    transitions: { requested: ['sent', 'provider_failed'], sent: ['confirmed', 'provider_failed'], confirmed: [], provider_failed: [] },
  },
  yield_reward: {
    initial: 'statement_received',
    transitions: { statement_received: ['matched', 'mismatch'], matched: ['credited'], credited: [], mismatch: ['matched'] },
  },
  loan: {
    initial: 'applied',
    transitions: {
      applied: ['approved', 'rejected'],
      approved: ['collateral_locked', 'rejected'],
      collateral_locked: ['funded'],
      funded: ['active'],
      active: ['repaid', 'margin_call'],
      margin_call: ['active', 'liquidating', 'repaid'],
      liquidating: ['repaid'],
      repaid: [],
      rejected: [],
    },
  },
  loan_repay: {
    initial: 'recorded',
    transitions: {
      recorded: ['awaiting_payment', 'selling', 'failed'],
      awaiting_payment: ['received', 'failed'],
      selling: ['received', 'failed'],
      received: ['applied'],
      applied: [],
      failed: [],
    },
  },
  loan_collateral: {
    initial: 'recorded',
    transitions: { recorded: ['sent', 'failed'], sent: ['lock_confirmed', 'failed'], lock_confirmed: ['ltv_updated'], ltv_updated: [], failed: [] },
  },
};

export const canTransition = <K extends TxKind>(kind: K, from: TxStatusByKind[K], to: TxStatusByKind[K]): boolean =>
  (machines[kind].transitions[from] as readonly string[]).includes(to);

export const isTerminal = <K extends TxKind>(kind: K, status: TxStatusByKind[K]): boolean =>
  (machines[kind].transitions[status] as readonly string[]).length === 0;
