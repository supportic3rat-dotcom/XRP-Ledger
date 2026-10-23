// Runs every migration and the seed in PGlite (real Postgres in WASM), then checks the ledger rules,
// RLS and separation of duties. Mirrors supabase/tests/*.test.sql for environments without Docker.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const db = new PGlite({ extensions: { pgcrypto } });

const BRENDAN = '00000000-0000-4000-8000-000000000042';
const TOBI = '00000000-0000-4000-8000-000000000420';
const OPS = '00000000-0000-4000-9000-00000000a001';
const OPS2 = '00000000-0000-4000-9000-00000000a002';
const COMP = '00000000-0000-4000-9000-00000000c001';
const COMP2 = '00000000-0000-4000-9000-00000000c002';
const AUDITOR = '00000000-0000-4000-9000-00000000d001';

let passed = 0;
const failures = [];
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
};
const assert = (cond, message) => { if (!cond) throw new Error(message); };
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const throwsLike = async (sql, pattern) => {
  try {
    await db.exec(sql);
  } catch (e) {
    if (!pattern.test(e.message)) throw new Error(`Wrong error: ${e.message}`);
    return;
  }
  throw new Error('Expected an error, got none');
};
/** Run SQL as a signed-in user, inside a transaction that is rolled back afterwards. */
const as = async (uid, role, fn) => {
  await db.exec('begin');
  try {
    await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', true),
                          set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, ...(role ? { app_role: role, aal: 'aal2' } : {}) })}', true);
                   set local role authenticated;`);
    return await fn();
  } finally {
    await db.exec('rollback');
  }
};
const balance = async (customer, kind) =>
  BigInt((await one(`select balance_drops::text b from balances where customer_id = $1 and kind = $2`, [customer, kind]))?.b ?? '0');

console.log('Applying Supabase stub, migrations and seed…');
await db.exec(readFileSync(join(here, 'supabase-stub.sql'), 'utf8'));
for (const file of readdirSync(join(root, 'migrations')).sort()) {
  try {
    await db.exec(readFileSync(join(root, 'migrations', file), 'utf8'));
  } catch (e) {
    console.error(`Migration ${file} failed: ${e.message}`);
    process.exit(1);
  }
  console.log(`  applied ${file}`);
}
try {
  await db.exec(readFileSync(join(root, 'seed.sql'), 'utf8'));
  console.log('  applied seed.sql (invariant checks passed)');
} catch (e) {
  console.error(`Seed failed: ${e.message}`);
  process.exit(1);
}

console.log('\nLedger invariants');
await test('seed balances match the design (4,170.10 / 1,500.00 / 750.00)', async () => {
  assert((await balance(BRENDAN, 'available')) === 4170100000n, 'available');
  assert((await balance(BRENDAN, 'yield')) === 1500000000n, 'yield');
  assert((await balance(BRENDAN, 'collateral')) === 750000000n, 'collateral');
  assert((await balance(BRENDAN, 'reserved')) === 0n, 'reserved');
});
await test('an unbalanced entry is rejected at commit', () =>
  throwsLike(`begin;
    insert into journal_entries (id, kind, reference, created_by) values ('99999999-0000-4000-8000-000000000001', 'test', 'T', 'test');
    insert into journal_lines (entry_id, account_id, amount_drops)
      values ('99999999-0000-4000-8000-000000000001', ledger_account(null, 'omnibus'), 5);
    insert into journal_lines (entry_id, account_id, amount_drops)
      values ('99999999-0000-4000-8000-000000000001', ledger_account(null, 'suspense'), -4);
    commit;`, /not balanced/).finally(() => db.exec('rollback')));
await test('posted lines are immutable', () => throwsLike(`update journal_lines set amount_drops = 1 where id = (select min(id) from journal_lines)`, /append-only/));
await test('posted entries cannot be deleted', () => throwsLike(`delete from journal_entries where reference = 'DEP-PROTO-1650'`, /append-only/));
await test('available balance can never go negative', () =>
  throwsLike(`select create_tx('${BRENDAN}', 'withdrawal', 'WD-TEST-NEG', 'requested', 999999000000, 'test')`, /Insufficient balance/));
await test('transition_tx refuses transitions outside the state machine', () =>
  throwsLike(`select transition_tx('10000000-0000-4000-8000-000000002041', 'credited', 'test')`, /not allowed/));
await test('deposit credit posts Dr omnibus / Cr available and notifies', async () => {
  await db.exec('begin');
  await db.exec(`select transition_tx('10000000-0000-4000-8000-000000002041', 'validated', 'test');
                 select transition_tx('10000000-0000-4000-8000-000000002041', 'screened', 'test');
                 select transition_tx('10000000-0000-4000-8000-000000002041', 'credited', 'test');`);
  const avail = await balance(BRENDAN, 'available');
  const note = await one(`select title from notifications where customer_id = $1 order by created_at desc limit 1`, [BRENDAN]);
  await db.exec('rollback');
  assert(avail === 5420100000n, `available ${avail}`);
  assert(note.title === 'Deposit credited', note.title);
});
await test('withdrawal reserves at request and settles with fee at validation', async () => {
  await db.exec('begin');
  const t = await one(`select id from create_tx('${BRENDAN}', 'withdrawal', 'WD-TEST-1', 'requested', 100250000, 'test', '{"fee_drops":"250000"}')`);
  const reserved = await balance(BRENDAN, 'reserved');
  for (const s of ['in_review', 'approved', 'submitted', 'validated']) await db.exec(`select transition_tx('${t.id}', '${s}', 'test')`);
  const after = await balance(BRENDAN, 'reserved');
  const fees = BigInt((await one(`select balance_drops::text b from balances where customer_id is null and kind = 'fee_revenue'`)).b);
  await db.exec('rollback');
  assert(reserved === 100250000n, `reserved ${reserved}`);
  assert(after === 0n, `reserved after ${after}`);
  assert(fees === 250000n + 250000n + 210000n, `fee revenue ${fees}`);
});
await test('liabilities equal holdings (omnibus + receivable = customer + suspense + fees)', async () => {
  const r = await one(`select
    sum(case when normal_side = 'debit' then balance_drops else 0 end)::text a,
    sum(case when normal_side = 'credit' then balance_drops else 0 end)::text l
    from balances b join ledger_accounts a on a.id = b.account_id`);
  assert(r.a === r.l, `assets ${r.a} vs liabilities ${r.l}`);
});

console.log('\nRow-level security');
await test('a customer sees only their own transactions', () =>
  as(BRENDAN, null, async () => {
    const r = await one(`select count(*)::int n, count(*) filter (where customer_id <> '${BRENDAN}')::int other from transactions`);
    assert(r.n === 7 && r.other === 0, JSON.stringify(r));
  }));
await test('a customer cannot insert into money tables', () =>
  as(BRENDAN, null, () => throwsLike(`insert into transactions (ref, customer_id, kind, status) values ('X', '${BRENDAN}', 'deposit', 'credited')`, /permission denied/)));
await test('a customer cannot call transition_tx', () =>
  as(BRENDAN, null, () => throwsLike(`select transition_tx('10000000-0000-4000-8000-000000002041', 'validated', 'me')`, /permission denied/)));
await test('a customer cannot read other customers or the audit log', () =>
  as(BRENDAN, null, async () => {
    assert((await one(`select count(*)::int n from customers`)).n === 1, 'customers');
    assert((await one(`select count(*)::int n from audit_events`)).n === 0, 'audit');
    assert((await one(`select count(*)::int n from customers_masked`)).n === 0, 'masked');
  }));
await test('personal data is masked by role', async () => {
  const get = (role, uid) => as(uid, role, () => one(`select full_name, email, phone, dob from customers_masked where account_ref = 'CUS-0042'`));
  const c = await get('compliance', COMP);
  const o = await get('operations', OPS);
  const a = await get('auditor', AUDITOR);
  assert(c.full_name === 'Tobi Adeyemi' && c.email === 'tobi.adeyemi@example.com', JSON.stringify(c));
  assert(o.full_name === 'Tobi A.' && o.email === 'to•••@example.com' && o.phone === '+234 ••• ••• 4821' && o.dob === '••••-••-•• (1991)', JSON.stringify(o));
  assert(a.full_name === 'T•••• A••••' && a.email === '•••@example.com' && a.phone === '•••• 4821' && a.dob === 'Hidden', JSON.stringify(a));
});
await test('only Compliance can select the base customers table', () =>
  as(OPS, 'operations', async () => assert((await one(`select count(*)::int n from customers`)).n === 0, 'ops sees customers')));

console.log('\nSeparation of duties');
const WD2042 = '30000000-0000-4000-8000-000000002042';
await test('the same role cannot give the second approval over 1,000 XRP', () =>
  as(COMP2, 'compliance', () => throwsLike(`select approval_decide('${WD2042}', 'approve')`, /different role/)));
await test('a person cannot decide twice', () =>
  as(COMP, 'compliance', () => throwsLike(`select approval_decide('${WD2042}', 'approve')`, /already decided/)));
await test('auditors cannot act', () =>
  as(AUDITOR, 'auditor', () => throwsLike(`select approval_decide('${WD2042}', 'approve')`, /Read-only/)));
await test('Operations cannot approve loans', () =>
  as(OPS, 'operations', () => throwsLike(`select approval_decide('30000000-0000-4000-8000-000000000009', 'approve')`, /can’t approve/)));
await test('Operations gives the second approval → withdrawal approved and audited', () =>
  as(OPS, 'operations', async () => {
    const r = await one(`select approval_decide('${WD2042}', 'approve') r`);
    const tx = await one(`select status from transactions where ref = 'WD-PROTO-2042'`);
    const audit = await one(`select action, target, role from audit_events order by id desc limit 1`);
    assert(r.r.status === 'approved', JSON.stringify(r));
    assert(tx.status === 'approved', tx.status);
    assert(audit.target === 'WD-PROTO-2042' && audit.role === 'operations', JSON.stringify(audit));
  }));
await test('a rejection needs a reason and a 10+ character note', () =>
  as(OPS, 'operations', () => throwsLike(`select approval_decide('30000000-0000-4000-8000-000000002043', 'reject', 'limits', 'short')`, /short note/)));
await test('a rejection posts the compensating entry and releases the hold', () =>
  as(OPS, 'operations', async () => {
    await db.exec(`select approval_decide('30000000-0000-4000-8000-000000002043', 'reject', 'limits', 'Exceeds the customer daily limit')`);
    const r = await one(`select kind, reverses_entry_id is not null rev from journal_entries where reference = 'WD-PROTO-2043' order by created_at desc limit 1`);
    const reserved = await one(`select balance_drops::text b from balances where customer_id = '00000000-0000-4000-8000-000000000187' and kind = 'reserved'`);
    assert(r.kind === 'withdrawal:rejected' && r.rev, JSON.stringify(r));
    assert(reserved.b === '0', reserved.b);
  }));
await test('deposit attribution credits the claimant from suspense', () =>
  as(OPS, 'operations', async () => {
    await db.exec(`select approval_decide('30000000-0000-4000-8000-000000002050', 'approve')`);
    const t = await one(`select status, customer_id from transactions where ref = 'DEP-PROTO-2050'`);
    const susp = await one(`select balance_drops::text b from balances where customer_id is null and kind = 'suspense'`);
    assert(t.status === 'credited' && t.customer_id === '00000000-0000-4000-8000-000000000311', JSON.stringify(t));
    assert(susp.b === '0', susp.b);
  }));
await test('a signing-policy change requested by Operations needs Compliance', async () => {
  const id = (await one(`select id from policy_changes where ref = 'POL-v4'`)).id;
  await as(OPS2, 'operations', () => throwsLike(`select policy_decide('${id}', 'approve')`, /needs Compliance/));
  await as(COMP, 'compliance', async () => {
    await db.exec(`select policy_decide('${id}', 'approve')`);
    const p = await one(`select status, effective_at > now() + interval '23 hours' delayed from policy_changes where id = '${id}'`);
    assert(p.status === 'approved' && p.delayed, JSON.stringify(p));
  });
});
await test('only Compliance can freeze accounts', async () => {
  await as(OPS, 'operations', () => throwsLike(`select customer_freeze('${TOBI}', true)`, /Only Compliance/));
  await as(COMP, 'compliance', async () => {
    await db.exec(`select customer_freeze('${TOBI}', true)`);
    assert((await one(`select frozen_at is not null f from customers where id = '${TOBI}'`)).f, 'not frozen');
  });
});


console.log('\nMoney RPCs');
const rpc = async (sql) => one(sql);
await test('withdrawal request reserves, opens a 1-approval review and is idempotent per key', async () => {
  await db.exec('begin');
  const t = await rpc(`select id, status from request_withdrawal('${BRENDAN}', 100000000, 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', 10293847, 'key-1')`);
  const a = await one(`select required from approvals where transaction_id = '${t.id}'`);
  const reserved = await balance(BRENDAN, 'reserved');
  let dup = '';
  try { await db.exec(`select request_withdrawal('${BRENDAN}', 100000000, 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', 10293847, 'key-1')`); } catch (e) { dup = e.message; }
  await db.exec('rollback');
  assert(t.status === 'in_review' && a.required === 1, JSON.stringify({ t, a }));
  assert(reserved === 100000000n, `reserved ${reserved}`);
  assert(/duplicate key/.test(dup), `idempotency: ${dup}`);
});
await test('over 1,000 XRP needs two approvals including Compliance', async () => {
  await db.exec('begin');
  const t = await rpc(`select id from request_withdrawal('${BRENDAN}', 1500000000, 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', null, 'key-2')`);
  const a = await one(`select required, requires_compliance from approvals where transaction_id = '${t.id}'`);
  await db.exec('rollback');
  assert(a.required === 2 && a.requires_compliance === true, JSON.stringify(a));
});
await test('allowlist on blocks new addresses', async () => {
  await db.exec(`begin; update customers set allowlist_enabled = true where id = '${BRENDAN}';`);
  let err = '';
  try { await db.exec(`select request_withdrawal('${BRENDAN}', 100000000, 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', 1, 'key-3')`); } catch (e) { err = e.message; }
  await db.exec('rollback');
  assert(/allowlist is on/.test(err), err);
});
await test('frozen and unverified customers cannot move money', async () => {
  await db.exec(`begin; update customers set frozen_at = now() where id = '${BRENDAN}';`);
  let a = '';
  try { await db.exec(`select request_exchange('${BRENDAN}', 100000000, 23800, 'k')`); } catch (e) { a = e.message; }
  await db.exec('rollback');
  await db.exec(`begin; update customers set kyc_status = 'in_progress' where id = '${BRENDAN}';`);
  let b = '';
  try { await db.exec(`select yield_allocate('${BRENDAN}', 100000000, 'v0.1', 'k')`); } catch (e) { b = e.message; }
  await db.exec('rollback');
  assert(/frozen/.test(a) && /Verify your identity/.test(b), `${a} | ${b}`);
});
await test('customer cancels a pending withdrawal and the hold is released', async () => {
  await db.exec('begin');
  const t = await rpc(`select id from request_withdrawal('${BRENDAN}', 100000000, 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', 1, 'key-4')`);
  await db.exec(`select cancel_withdrawal('${BRENDAN}', '${t.id}')`);
  const reserved = await balance(BRENDAN, 'reserved');
  await db.exec('rollback');
  assert(reserved === 0n, `reserved ${reserved}`);
});
await test('exchange reserves only when a live quote is accepted; expired quotes fail', async () => {
  await db.exec('begin');
  const t = await rpc(`select id from request_exchange('${BRENDAN}', 500000000, 117660, 'key-5')`);
  const before = await balance(BRENDAN, 'reserved');
  await db.exec(`select transition_tx('${t.id}', 'quote_requested', 'ops')`);
  const q = await rpc(`select id from record_quote('${t.id}', 2374200, 1337, 116373, now() - interval '1 second')`);
  let expired = '';
  try { await db.exec(`select accept_quote('${BRENDAN}', '${t.id}', '${q.id}')`); } catch (e) { expired = e.message; }
  await db.exec('rollback');
  await db.exec('begin');
  const t2 = await rpc(`select id from request_exchange('${BRENDAN}', 500000000, 117660, 'key-6')`);
  await db.exec(`select transition_tx('${t2.id}', 'quote_requested', 'ops')`);
  const q2 = await rpc(`select id from record_quote('${t2.id}', 2374200, 1337, 116373, now() + interval '60 seconds')`);
  await db.exec(`select accept_quote('${BRENDAN}', '${t2.id}', '${q2.id}')`);
  const after = await balance(BRENDAN, 'reserved');
  await db.exec('rollback');
  assert(before === 0n, `reserved before ${before}`);
  assert(/expired/.test(expired), expired);
  assert(after === 500000000n, `reserved after ${after}`);
});
await test('collateral top-up reserves, then locks on provider confirmation', async () => {
  await db.exec('begin');
  const t = await rpc(`select id from loan_add_collateral('${BRENDAN}', '20000000-0000-4000-8000-000000000007', 250000000, 'key-7')`);
  const reserved = await balance(BRENDAN, 'reserved');
  await db.exec(`select transition_tx('${t.id}', 'sent', 'sys'); select transition_tx('${t.id}', 'lock_confirmed', 'provider');`);
  const coll = await balance(BRENDAN, 'collateral');
  const loanColl = await one(`select collateral_drops::text c from loans where ref = 'LN-PROTO-0007'`);
  await db.exec('rollback');
  assert(reserved === 250000000n && coll === 1000000000n && loanColl.c === '1000000000', JSON.stringify({ reserved: String(reserved), coll: String(coll), loanColl }));
});
await test('full repayment releases all collateral to available', async () => {
  await db.exec('begin');
  const t = await rpc(`select id from loan_repay('${BRENDAN}', '20000000-0000-4000-8000-000000000007', 60493, 'bank', 'key-8')`);
  await db.exec(`select transition_tx('${t.id}', 'received', 'provider'); select transition_tx('${t.id}', 'applied', 'provider');`);
  const avail = await balance(BRENDAN, 'available');
  const coll = await balance(BRENDAN, 'collateral');
  const loan = await one(`select status from loans where ref = 'LN-PROTO-0007'`);
  await db.exec('rollback');
  assert(coll === 0n && avail === 4920100000n && loan.status === 'repaid', `${coll} ${avail} ${loan.status}`);
});
await test('over-repayment is refused', async () => {
  let err = '';
  try { await db.exec(`select loan_repay('${BRENDAN}', '20000000-0000-4000-8000-000000000007', 99999999, 'bank', 'k9')`); } catch (e) { err = e.message; }
  assert(/more than you owe/.test(err), err);
});


console.log('\nAccount actions');
await test('a password change revokes other devices and holds withdrawals for 24 hours', async () => {
  await db.exec('begin');
  await db.exec(`select password_changed('${BRENDAN}', gen_random_uuid())`);
  const live = await one(`select count(*)::int n from devices where customer_id = '${BRENDAN}' and revoked_at is null`);
  let err = '';
  try { await db.exec(`select request_withdrawal('${BRENDAN}', 100000000, 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', 1, 'key-h')`); } catch (e) { err = e.message; }
  await db.exec('rollback');
  assert(/on hold until/.test(err), err);
  assert(live.n === 0, `live devices ${live.n}`);
});
await test('allowlist addresses activate after 24 hours and cannot be added twice', async () => {
  await db.exec('begin');
  const a = await one(`select (active_from - now()) > interval '23 hours' as later from allowlist_add('${BRENDAN}', 'Ledger', 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', null)`);
  let dup = '';
  try { await db.exec(`select allowlist_add('${BRENDAN}', 'Again', 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', null)`); } catch (e) { dup = e.message; }
  await db.exec('rollback');
  assert(a.later === true && /already saved/.test(dup), dup);
});
await test('tickets need 20+ characters and get an automatic reply', async () => {
  await db.exec('begin');
  let short = '';
  try { await db.exec(`select ticket_create('${BRENDAN}', 'Withdrawal', null, 'too short')`); } catch (e) { short = e.message; }
  await db.exec('rollback; begin');
  const t = await one(`select ref, status from ticket_create('${BRENDAN}', 'Withdrawal', null, 'My withdrawal has been in review for a while.')`);
  const m = await one(`select count(*)::int n from ticket_messages where ticket_ref = '${t.ref}'`);
  await db.exec('rollback');
  assert(/at least 20/.test(short) && /^SUP-\d{4}$/.test(t.ref) && t.status === 'waiting_on_us' && m.n === 2, JSON.stringify({ short, t, m }));
});
await test('KYC decision updates the customer and notifies them', async () => {
  await db.exec(`begin; update customers set kyc_status = 'not_started' where id = '${BRENDAN}';`);
  await db.exec(`select kyc_started('${BRENDAN}', 'kyc-test-1', 'passport', 'NG', '{}')`);
  await db.exec(`select kyc_decided('kyc-test-1', 'verified')`);
  const c = await one(`select kyc_status from customers where id = '${BRENDAN}'`);
  const n = await one(`select title from notifications where customer_id = '${BRENDAN}' order by created_at desc limit 1`);
  await db.exec('rollback');
  assert(c.kyc_status === 'verified' && n.title === 'Identity verified', JSON.stringify({ c, n }));
});


console.log('\nSessions and reconciliation');
await test('staff roles apply on a password-only (aal1) session', async () => {
  await db.exec('begin');
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: OPS, app_role: 'operations', aal: 'aal1' })}', true)`);
  const r = await one(`select public.app_role() r, public.is_staff() s`);
  await db.exec('rollback');
  assert(r.r === 'operations' && r.s === true, JSON.stringify(r));
});
await test('a customer session is never staff', async () => {
  await db.exec('begin');
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: BRENDAN, aal: 'aal1' })}', true)`);
  const r = await one(`select public.app_role() r, public.is_staff() s`);
  await db.exec('rollback');
  assert(r.r === null && r.s === false, JSON.stringify(r));
});
await test('a backup code works once and upgrades only its own session to aal2', async () => {
  await db.exec('begin');
  await db.exec(`select set_backup_codes('${BRENDAN}', array['AB12-CD34','EF56-GH78','JK9A-LM2B','NP3C-QR4D','ST5E-UV6F','WX7G-YZ8H','A2B3-C4D5','E6F7-G8H9'])`);
  const session = '11111111-1111-4111-8111-111111111111';
  const first = await one(`select consume_backup_code('${BRENDAN}', 'ab12-cd34', '${session}') ok`);
  const again = await one(`select consume_backup_code('${BRENDAN}', 'AB12-CD34', '${session}') ok`);
  const mine = await one(`select custom_access_token_hook($1::jsonb) -> 'claims' ->> 'aal' aal`, [JSON.stringify({ user_id: BRENDAN, claims: { aal: 'aal1', session_id: session } })]);
  const other = await one(`select custom_access_token_hook($1::jsonb) -> 'claims' ->> 'aal' aal`, [JSON.stringify({ user_id: BRENDAN, claims: { aal: 'aal1', session_id: '22222222-2222-4222-8222-222222222222' } })]);
  await db.exec('rollback');
  assert(first.ok === true && again.ok === false, `first ${first.ok} again ${again.ok}`);
  assert(mine.aal === 'aal2' && other.aal === 'aal1', `${mine.aal} ${other.aal}`);
});
await test('2FA turn-off waits 24 hours and can be cancelled', async () => {
  await db.exec(`begin; insert into auth.mfa_factors (user_id, factor_type, status) values ('${BRENDAN}', 'totp', 'verified');`);
  await db.exec(`select request_mfa_disable('${BRENDAN}')`);
  const early = await one(`select apply_mfa_disable() n, has_totp('${BRENDAN}') t`);
  await db.exec(`update customers set mfa_disable_at = now() - interval '1 minute' where id = '${BRENDAN}'`);
  const late = await one(`select apply_mfa_disable() n`);
  const after = await one(`select has_totp('${BRENDAN}') t`);
  await db.exec('rollback');
  assert(early.n === 0 && early.t === true && late.n === 1 && after.t === false, JSON.stringify({ early, late, after }));
});
await test('reconciliation inputs: liabilities, suspense and delayed provider steps', async () => {
  const r = (await one(`select recon_inputs() j`)).j;
  assert(BigInt(r.customer_liabilities_drops) > 0n, JSON.stringify(r));
  assert(r.suspense_deposits.some((d) => d.ref === 'DEP-PROTO-2050') && BigInt(r.suspense_drops) === 500000000n, JSON.stringify(r.suspense_deposits));
  assert(Array.isArray(r.wallets) && r.wallets.length === 3, 'wallets');
});
await test('a yield statement line credits net of the 10% fee, once per event line', async () => {
  await db.exec('begin');
  const before = await balance(BRENDAN, 'available');
  const t = await one(`select status, fee_drops::text f from record_yield_reward('ACC-PROTO-0042', 10000000, '2026-10', 'evt-1:0')`);
  const again = await one(`select count(*)::int n from (select record_yield_reward('ACC-PROTO-0042', 10000000, '2026-10', 'evt-1:0')) x`);
  const after = await balance(BRENDAN, 'available');
  const n = await one(`select count(*)::int n from transactions where idempotency_key = 'evt-1:0'`);
  await db.exec('rollback');
  assert(t.status === 'credited' && t.f === '1000000' && after - before === 9000000n && n.n === 1 && again.n === 1, JSON.stringify({ t, d: String(after - before), n }));
});
await test('only Operations books a fee adjustment, as a balanced journal with a reason', async () => {
  await db.exec('begin');
  const run = await one(`select id from recon_record(90000000, '{}'::jsonb, '[{"kind":"unbooked_fee","title":"Unbooked network fee","note":"test","amount_drops":"12"}]'::jsonb, 'System')`);
  const x = await one(`select id from recon_exceptions where run_id = '${run.id}'`);
  await db.exec('commit');
  await as(COMP, 'compliance', () => throwsLike(`select recon_adjust('${x.id}', 'Network fee for WD-PROTO-2088')`, /Operations/));
  await as(OPS, 'operations', () => throwsLike(`select recon_adjust('${x.id}', 'short')`, /10 characters/));
  const posted = await as(OPS, 'operations', async () => {
    await db.exec(`select recon_adjust('${x.id}', 'Network fee for WD-PROTO-2088')`);
    return one(`select status from recon_exceptions where id = '${x.id}'`);
  });
  await db.exec(`delete from recon_exceptions where id = '${x.id}'`);
  assert(posted.status === 'resolved', JSON.stringify(posted));
});


console.log('\nXRPL worker writes');
await test('a tagged deposit is credited once, even if the ledger is replayed', async () => {
  await db.exec('begin');
  const before = await balance(BRENDAN, 'available');
  const tag = (await one(`select destination_tag::text t from customers where id = '${BRENDAN}'`)).t;
  const a = await one(`select status from chain_record_deposit('HASHDEP1', 92420000, ${tag}, 25000000, 'rSendrXk3PaKcV9tYwZ2hNproto9Qa', false)`);
  await one(`select status from chain_record_deposit('HASHDEP1', 92420000, ${tag}, 25000000, 'rSendrXk3PaKcV9tYwZ2hNproto9Qa', false)`);
  const after = await balance(BRENDAN, 'available');
  await db.exec('rollback');
  assert(a.status === 'credited' && after - before === 25000000n, `${a.status} ${after - before}`);
});
await test('a missing or unknown tag goes to suspense', async () => {
  await db.exec('begin');
  const a = await one(`select status, customer_id from chain_record_deposit('HASHDEP2', 92420001, null, 30000000, 'rSendrXk3PaKcV9tYwZ2hNproto9Qa', false)`);
  const b = await one(`select status from chain_record_deposit('HASHDEP3', 92420001, 4000000001, 30000000, 'rSendrXk3PaKcV9tYwZ2hNproto9Qa', false)`);
  await db.exec('rollback');
  assert(a.status === 'no_tag' && a.customer_id === null && b.status === 'no_tag', JSON.stringify({ a, b }));
});
await test('a screening hit waits for Compliance instead of crediting', async () => {
  await db.exec('begin');
  const tag = (await one(`select destination_tag::text t from customers where id = '${BRENDAN}'`)).t;
  const before = await balance(BRENDAN, 'available');
  const a = await one(`select status from chain_record_deposit('HASHDEP4', 92420002, ${tag}, 30000000, 'rSendrXk3PaKcV9tYwZ2hNproto9Qa', true)`);
  const after = await balance(BRENDAN, 'available');
  await db.exec('rollback');
  assert(a.status === 'screening_hold' && after === before, a.status);
});
await test('a withdrawal completes only through validation, booking the actual fee', async () => {
  await db.exec('begin');
  const t = await rpc(`select id from request_withdrawal('${BRENDAN}', 100000000, 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', 1, 'key-w')`);
  await db.exec(`update approvals set status = 'approved' where transaction_id = '${t.id}'; select transition_tx('${t.id}', 'approved', 'test');`);
  await db.exec(`select chain_withdrawal_submitted('${t.id}', 'tr-1', 92420020)`);
  const v = await one(`select status, ledger_hash, meta ->> 'actual_fee_drops' fee from chain_withdrawal_validated('${t.id}', 'HASHWD1', 92420010, 12)`);
  const reserved = await balance(BRENDAN, 'reserved');
  await db.exec('rollback');
  assert(v.status === 'validated' && v.ledger_hash === 'HASHWD1' && v.fee === '12' && reserved === 0n, JSON.stringify(v));
});
await test('an expired withdrawal fails and the hold returns to available', async () => {
  await db.exec('begin');
  const before = await balance(BRENDAN, 'available');
  const t = await rpc(`select id from request_withdrawal('${BRENDAN}', 100000000, 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', 1, 'key-x')`);
  await db.exec(`select transition_tx('${t.id}', 'approved', 'test'); select chain_withdrawal_submitted('${t.id}', 'tr-2', 92420020);`);
  await db.exec(`select chain_withdrawal_failed('${t.id}', 'Expired: LastLedgerSequence passed')`);
  const after = await balance(BRENDAN, 'available');
  await db.exec('rollback');
  assert(after === before, `${before} → ${after}`);
});

console.log('\nMulti-asset');
const balanceIn = async (customer, kind, asset) =>
  BigInt((await one(`select balance_drops::text b from balances where customer_id = $1 and kind = $2 and asset = $3`, [customer, kind, asset]))?.b ?? '0');
const actAs = (uid, role) =>
  db.exec(`select set_config('request.jwt.claim.sub', '${uid}', true),
                  set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, app_role: role, aal: 'aal2' })}', true);
           set local role authenticated;`);
const BTC_ADDR = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const credit = async (asset, units) => {
  const t = await rpc(`select id from create_tx('${BRENDAN}', 'deposit', 'DEP-T-${asset}', 'reported', ${units}, 'test', '{"asset": "${asset}"}')`);
  await db.exec(`select transition_tx('${t.id}', 'validated', 't'); select transition_tx('${t.id}', 'screened', 't'); select transition_tx('${t.id}', 'credited', 't');`);
};
await test('an entry must balance within each asset, not just in total', () =>
  throwsLike(`begin;
    insert into journal_entries (id, kind, reference, created_by) values ('99999999-0000-4000-8000-000000000002', 'test', 'T', 'test');
    insert into journal_lines (entry_id, account_id, amount_drops) values ('99999999-0000-4000-8000-000000000002', ledger_account(null, 'omnibus', 'BTC'), 5);
    insert into journal_lines (entry_id, account_id, amount_drops) values ('99999999-0000-4000-8000-000000000002', ledger_account(null, 'suspense', 'XRP'), -5);
    commit;`, /not balanced in/).finally(() => db.exec('rollback')));
await test('a reported BTC deposit is credited only after a second person approves it', async () => {
  await db.exec(`begin; update assets set deposit_address = '${BTC_ADDR}' where id = 'BTC';`);
  const t = await rpc(`select id, status, asset from report_deposit('${BRENDAN}', 'BTC', 2500000, 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16', null, 'dep-key')`);
  const before = await balanceIn(BRENDAN, 'available', 'BTC');
  let dup = '';
  try { await db.exec(`savepoint s; select report_deposit('${BRENDAN}', 'BTC', 2500000, 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16', null, 'dep-key-2')`); } catch (e) { dup = e.message; }
  await db.exec('rollback to savepoint s');
  const ap = await one(`select id from approvals where transaction_id = '${t.id}'`);
  await actAs(OPS, 'operations');
  await db.exec(`select approval_decide('${ap.id}', 'approve')`);
  await db.exec('reset role');
  const after = await balanceIn(BRENDAN, 'available', 'BTC');
  const xrp = await balanceIn(BRENDAN, 'available', 'XRP');
  const status = (await one(`select status from transactions where id = '${t.id}'`)).status;
  await db.exec('rollback');
  assert(t.status === 'reported' && t.asset === 'BTC' && before === 0n, JSON.stringify(t));
  assert(/already been reported/.test(dup), dup);
  assert(status === 'credited' && after === 2500000n && xrp === 4170100000n, `${status} ${after} ${xrp}`);
});
await test('a rejected reported deposit credits nothing', async () => {
  await db.exec(`begin; update assets set deposit_address = '0x52908400098527886E0F7030069857D2E4169EE7' where id = 'ETH';`);
  const t = await rpc(`select id from report_deposit('${BRENDAN}', 'ETH', 5000000, '0xabc123def4567890', null, 'dep-eth')`);
  const ap = await one(`select id from approvals where transaction_id = '${t.id}'`);
  await actAs(COMP, 'compliance');
  await db.exec(`select approval_decide('${ap.id}', 'reject', 'evidence', 'Not found on the Ethereum network.')`);
  await db.exec('reset role');
  const status = (await one(`select status from transactions where id = '${t.id}'`)).status;
  const bal = await balanceIn(BRENDAN, 'available', 'ETH');
  await db.exec('rollback');
  assert(status === 'rejected' && bal === 0n, `${status} ${bal}`);
});
await test('staff can’t approve a deposit they recorded themselves', async () => {
  await db.exec('begin');
  await actAs(OPS, 'operations');
  const t = await rpc(`select id from staff_record_deposit('${BRENDAN}', 'USDT', 250000000, 'trxhash12345678', 'Seen in wallet')`);
  const ap = await one(`select id from approvals where transaction_id = '${t.id}'`);
  let err = '';
  try { await db.exec(`savepoint s; select approval_decide('${ap.id}', 'approve')`); } catch (e) { err = e.message; }
  await db.exec('rollback to savepoint s');
  await actAs(OPS2, 'operations');
  await db.exec(`select approval_decide('${ap.id}', 'approve')`);
  await db.exec('reset role');
  const bal = await balanceIn(BRENDAN, 'available', 'USDT');
  await db.exec('rollback');
  assert(/you raised/.test(err) && bal === 250000000n, `${err} ${bal}`);
});
await test('a BTC withdrawal validates the address, reserves BTC and is marked sent by staff', async () => {
  await db.exec('begin');
  await credit('BTC', 10000000);
  let bad = '';
  try { await db.exec(`savepoint s; select request_withdrawal('${BRENDAN}', 1000000, 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', null, 'wb-0', false, 'BTC')`); } catch (e) { bad = e.message; }
  await db.exec('rollback to savepoint s');
  const t = await rpc(`select id from request_withdrawal('${BRENDAN}', 1000000, '${BTC_ADDR}', null, 'wb-1', false, 'BTC')`);
  const reserved = await balanceIn(BRENDAN, 'reserved', 'BTC');
  await db.exec(`select transition_tx('${t.id}', 'approved', 'test')`);
  await actAs(OPS, 'operations');
  const v = await rpc(`select status from withdrawal_mark_sent('${t.id}', 'b6f6991d03df0e2e04dafffcd6bc418aac66049e2cd74b80f14ac86db1e3f0da')`);
  await db.exec('reset role');
  const fee = await one(`select balance_drops::text b from balances where customer_id is null and kind = 'fee_revenue' and asset = 'BTC'`);
  const left = await balanceIn(BRENDAN, 'available', 'BTC');
  await db.exec('rollback');
  assert(/valid Bitcoin address/.test(bad), bad);
  assert(reserved === 1000000n && v.status === 'validated' && fee.b === '5000' && left === 9000000n, JSON.stringify({ reserved: String(reserved), v, fee, left: String(left) }));
});
await test('a BTC → XRP swap moves BTC out and credits XRP when paid out', async () => {
  await db.exec('begin');
  await credit('BTC', 10000000);
  const t = await rpc(`select id from request_exchange('${BRENDAN}', 1000000, 81800, 'sw-1', 'BTC', 'XRP')`);
  await db.exec(`select transition_tx('${t.id}', 'quote_requested', 'ops')`);
  const q = await rpc(`select id from record_quote('${t.id}', 81800000000, 818, 0, now() + interval '60 seconds', 608000000)`);
  await db.exec(`select accept_quote('${BRENDAN}', '${t.id}', '${q.id}'); select transition_tx('${t.id}', 'sold', 'lp'); select transition_tx('${t.id}', 'paid_out', 'lp');`);
  const btc = await balanceIn(BRENDAN, 'available', 'BTC');
  const xrp = await balanceIn(BRENDAN, 'available', 'XRP');
  await db.exec('rollback');
  assert(btc === 9000000n && xrp === 4170100000n + 608000000n, `${btc} ${xrp}`);
});
await test('ETH collateral: LTV is checked at the ETH price and precision', async () => {
  await db.exec('begin');
  await credit('ETH', 100000000);
  let high = '';
  try { await db.exec(`savepoint s; select loan_apply('${BRENDAN}', 100000000, 150100, 3000000000, 'v0.1', 'ln-1', 'ETH')`); } catch (e) { high = e.message; }
  await db.exec('rollback to savepoint s');
  const t = await rpc(`select id, asset from loan_apply('${BRENDAN}', 100000000, 150000, 3000000000, 'v0.1', 'ln-2', 'ETH')`);
  let doge = '';
  try { await db.exec(`savepoint s2; select loan_apply('${BRENDAN}', 100000000, 10000, 3000000000, 'v0.1', 'ln-3', 'DOGE')`); } catch (e) { doge = e.message; }
  await db.exec('rollback to savepoint s2');
  await db.exec(`select transition_tx('${t.id}', 'approved', 't'); select transition_tx('${t.id}', 'collateral_locked', 't');
                 select transition_tx('${t.id}', 'funded', 't'); select transition_tx('${t.id}', 'active', 't');`);
  const loan = await one(`select collateral_asset, collateral_drops::text c, principal_usd_cents::text p from loans where ref = (select ref from transactions where id = '${t.id}')`);
  const coll = await balanceIn(BRENDAN, 'collateral', 'ETH');
  await db.exec('rollback');
  assert(/50% starting LTV/.test(high), high);
  assert(/can’t be used as collateral/.test(doge), doge);
  assert(t.asset === 'ETH' && loan?.collateral_asset === 'ETH' && loan.c === '100000000' && coll === 100000000n, JSON.stringify({ t, loan, coll: String(coll) }));
});
await test('per-asset yield: SOL allocation confirms into a SOL position', async () => {
  await db.exec('begin');
  await credit('SOL', 500000000);
  const t = await rpc(`select id from yield_allocate('${BRENDAN}', 200000000, 'v0.1', 'y-sol', 'SOL')`);
  await db.exec(`select transition_tx('${t.id}', 'sent', 't'); select transition_tx('${t.id}', 'confirmed', 't');`);
  const pos = await one(`select asset, allocated_drops::text a, apr_bps from yield_positions where customer_id = '${BRENDAN}' and product = 'sol_flexible'`);
  await db.exec('rollback');
  assert(pos?.asset === 'SOL' && pos.a === '200000000' && pos.apr_bps === 500, JSON.stringify(pos));
});
await test('only Compliance sets deposit addresses, and they must match the network', async () => {
  await as(OPS, 'operations', () => throwsLike(`select asset_set_deposit_address('BTC', '${BTC_ADDR}', null, true)`, /Only Compliance/));
  await as(COMP, 'compliance', async () => {
    await throwsLike(`select asset_set_deposit_address('BTC', '0x52908400098527886E0F7030069857D2E4169EE7', null, true)`, /valid Bitcoin address/);
  });
  await as(COMP, 'compliance', async () => {
    await db.exec(`select asset_set_deposit_address('BTC', '${BTC_ADDR}', null, true)`);
    assert((await one(`select deposit_address from assets where id = 'BTC'`)).deposit_address === BTC_ADDR, 'not set');
  });
});

await test('customers set only their own notification preferences', async () => {
  const r = await as(BRENDAN, null, async () => {
    await db.exec(`select set_notification_prefs(false, true)`);
    return one(`select email_receipts, price_alerts from customers where id = '${BRENDAN}'`);
  });
  assert(r.email_receipts === false && r.price_alerts === true, JSON.stringify(r));
});

console.log('\nScheduled jobs');
await test('every worker job runs', async () => {
  for (const job of ['ltv-check', 'quote-expiry', 'yield-accrual', 'audit-verify', 'mfa-disable', 'balances-snapshot']) await db.exec(`select run_job('${job}')`).catch((e) => { throw new Error(`${job}: ${e.message}`); });
});
await test('an unknown job is refused', () => throwsLike(`select run_job('drop-everything')`, /Unknown job/));
await test('customers cannot run jobs or call the job functions', async () => {
  await as(BRENDAN, null, () => throwsLike(`select run_job('ltv-check')`, /permission denied/));
  await as(BRENDAN, null, () => throwsLike(`select ltv_check()`, /permission denied/));
});

console.log('\nAudit chain');
await test('the seeded chain verifies', async () => assert((await one(`select verify_audit_chain() b`)).b === null, 'broken'));
await test('editing any entry breaks the chain', async () => {
  await db.exec(`begin; set local session_replication_role = replica;
                 update audit_events set action = 'tampered' where id = 3;`);
  const b = (await one(`select verify_audit_chain()::int b`)).b;
  await db.exec('rollback');
  assert(b === 3, `broken at ${b}`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
