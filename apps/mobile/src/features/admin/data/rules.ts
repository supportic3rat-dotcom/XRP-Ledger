import { type QueueItem, ROLES, type Role, type Staff } from './types';

/**
 * Why the current staff member can't approve this item, or '' if they can. Mirrors approval_decide in SQL,
 * which enforces it again; the console only explains it up front.
 */
export const approveBlock = (it: QueueItem, me: Staff): string => {
  const can = ROLES[me.role].can;
  if (!can.includes(it.kind)) return can.length ? `Your role can’t approve ${it.type.toLowerCase()}s.` : 'Read-only role: you can view but not act.';
  if (it.approvals.some((a) => a.staffId === me.id)) return 'Separation of duties: you have already decided this request.';
  if (it.required === 2 && it.approvals.some((a) => a.role === me.role)) {
    return 'Separation of duties: the first approval came from your role. The second must come from a different role.';
  }
  if (it.requestedBy === me.id) return 'Separation of duties: you can’t decide a request you raised.';
  return '';
};

export const canReject = (it: QueueItem, role: Role): boolean => ROLES[role].can.includes(it.kind);
