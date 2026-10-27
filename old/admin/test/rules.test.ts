import { describe, expect, it } from 'vitest';
import { createDemoData, resetDemo } from '@/lib/data/demo';
import { queueStatus } from '@/lib/data/status';
import type { QueueItem, Staff } from '@/lib/data/types';
import { age, xrpAuto, xrpDiff } from '@/lib/format';
import { maskPersonal } from '@/lib/mask';
import { approveBlock } from '@/lib/rules';

const ops: Staff = { id: 'ops', name: 'A. Bello', role: 'operations' };
const comp: Staff = { id: 'comp', name: 'K. Musa', role: 'compliance' };
const item = (o: Partial<QueueItem> = {}): QueueItem => ({
  id: 'q',
  ref: 'WD-1',
  customer: 'CUS-1',
  kind: 'withdrawal',
  type: 'Withdrawal',
  amount: '',
  age: '',
  summary: '',
  checks: [],
  required: 1,
  approvals: [],
  journal: [],
  audit: [],
  decided: null,
  requestedBy: null,
  claimant: null,
  ...o,
});

describe('approveBlock (mirrors approval_decide)', () => {
  it('lets a permitted role approve', () => expect(approveBlock(item(), ops)).toBe(''));
  it('blocks roles that cannot decide the kind', () =>
    expect(approveBlock(item({ kind: 'loan', type: 'Loan application' }), ops)).toBe('Your role can’t approve loan applications.'));
  it('blocks the auditor', () => expect(approveBlock(item(), { ...ops, role: 'auditor' })).toBe('Read-only role: you can view but not act.'));
  it('blocks the same role for the second of two approvals', () =>
    expect(approveBlock(item({ required: 2, approvals: [{ who: 'J. Duru', at: '', role: 'compliance', staffId: 'x' }] }), comp)).toMatch(
      /first approval came from your role/,
    ));
  it('blocks the requester', () => expect(approveBlock(item({ requestedBy: 'ops' }), ops)).toMatch(/you raised/));
});

describe('queueStatus', () => {
  it('counts towards two approvals', () =>
    expect(queueStatus(item({ required: 2, approvals: [{ who: '', at: '', role: 'compliance', staffId: 'x' }] }))).toEqual(['Awaiting 2 of 2', 'wait']));
  it('shows a rejection', () => expect(queueStatus(item({ decided: { kind: 'rejected', reason: 'x', note: 'y' } }))).toEqual(['Rejected', 'bad']));
});

describe('masking (same rules as customers_masked)', () => {
  const p = { name: 'Tobi Adeyemi', email: 'tobi.adeyemi@example.com', phone: '+234 803 555 4821', dob: '1991-04-12' };
  it('operations sees partial data', () =>
    expect(maskPersonal(p, 'operations')).toEqual({ name: 'Tobi A.', email: 'to•••@example.com', phone: '+234 ••• ••• 4821', dob: '••••-••-•• (1991)' }));
  it('auditors see initials only', () =>
    expect(maskPersonal(p, 'auditor')).toEqual({ name: 'T•••• A••••', email: '•••@example.com', phone: '•••• 4821', dob: 'Hidden' }));
  it('compliance sees everything', () => expect(maskPersonal(p, 'compliance')).toEqual(p));
});

describe('formatting', () => {
  it('shows sub-cent totals with six decimals', () => {
    expect(xrpAuto(1_284_610_250_036n)).toBe('1,284,610.250036');
    expect(xrpAuto(1_284_610_250_000n)).toBe('1,284,610.25');
    expect(xrpDiff(-36n)).toBe('−0.000036');
  });
  it('formats ages like the queue', () => {
    const now = new Date('2026-10-19T12:00:00Z');
    expect(age(new Date('2026-10-19T10:55:00Z'), now)).toBe('1h 05m');
    expect(age(new Date('2026-10-19T09:00:00Z'), now)).toBe('3h');
  });
});

describe('demo source enforces the same rules', () => {
  it('refuses a rejection without a reason, and a second approval from the same person', async () => {
    resetDemo();
    const data = createDemoData('operations');
    expect(await data.decide('wd2043', 'reject')).toMatchObject({ ok: false });
    expect(await data.decide('ln0009', 'approve')).toMatchObject({ ok: false, error: 'Your role can’t approve loan applications.' });
    expect(await data.decide('wd2043', 'approve')).toEqual({ ok: true });
    expect(await data.decide('wd2043', 'approve')).toMatchObject({ ok: false });
  });
});
