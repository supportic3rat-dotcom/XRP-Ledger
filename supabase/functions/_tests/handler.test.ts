import { assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { handler as withdraw } from '../withdraw-request/index.ts';
import { handler as approve } from '../approval-decide/index.ts';
import { handler as recon } from '../recon-run/index.ts';
import { CUSTOMER, fakeDeps, post, token } from './fakes.ts';

const customer = (aal: 'aal1' | 'aal2' = 'aal2') => `Bearer ${token({ sub: CUSTOMER, aal, session_id: '11111111-1111-4111-8111-111111111111' })}`;
const staff = (role: string, aal: 'aal1' | 'aal2' = 'aal2') => `Bearer ${token({ sub: '00000000-0000-4000-9000-00000000a001', app_role: role, aal })}`;
const withdrawal = { amountDrops: '300000000', destination: 'rRecipXk3PaKcV9tYwZ2hNproto7Hd', destinationTag: '10293847' };
const txRow = { id: 'tx-1', ref: 'WD-002101', status: 'in_review', customer_id: CUSTOMER, kind: 'withdrawal', amount_drops: 300000000, amount_cents: null, meta: {} };
const rpcs = {
  touch_device: () => ({ data: { withdrawals_paused_until: null }, error: null }),
  request_withdrawal: () => ({ data: txRow, error: null }),
};

Deno.test('refuses unauthenticated calls', async () => {
  const { deps } = fakeDeps();
  const res = await withdraw(post(withdrawal), deps);
  assertEquals(res.status, 401);
});

Deno.test('a password-only (aal1) session can make money requests', async () => {
  const { deps } = fakeDeps({ rpcs });
  const res = await withdraw(post(withdrawal, { Authorization: customer('aal1'), 'Idempotency-Key': 'key-00000001' }), deps);
  assertEquals(res.status, 200);
});

Deno.test('rejects amounts that are not integer drops (no floats)', async () => {
  const { deps } = fakeDeps();
  const res = await withdraw(post({ ...withdrawal, amountDrops: '300.5' }, { Authorization: customer(), 'Idempotency-Key': 'key-00000002' }), deps);
  assertEquals(res.status, 400);
  assertMatch((await res.json()).error, /integer number of drops/);
});

Deno.test('requires an Idempotency-Key on money actions', async () => {
  const { deps } = fakeDeps();
  const res = await withdraw(post(withdrawal, { Authorization: customer() }), deps);
  assertEquals(res.status, 400);
  assertEquals((await res.json()).code, 'idempotency_key');
});

Deno.test('a retry with the same key replays the first response and posts once', async () => {
  const { deps, calls } = fakeDeps({ rpcs });
  const headers = { Authorization: customer(), 'Idempotency-Key': 'key-00000003' };
  const first = await withdraw(post(withdrawal, headers), deps);
  const second = await withdraw(post(withdrawal, headers), deps);
  assertEquals(first.status, 200);
  assertEquals(second.status, 200);
  assertEquals(second.headers.get('Idempotent-Replayed'), 'true');
  assertEquals(await first.json(), await second.json());
  assertEquals(calls.filter((c) => c.fn === 'request_withdrawal').length, 1);
});

Deno.test('the same key with a different body is refused', async () => {
  const { deps } = fakeDeps({ rpcs });
  const headers = { Authorization: customer(), 'Idempotency-Key': 'key-00000004' };
  await withdraw(post(withdrawal, headers), deps);
  const res = await withdraw(post({ ...withdrawal, amountDrops: '400000000' }, headers), deps);
  assertEquals(res.status, 422);
});

Deno.test('SQL rule violations come back as customer-facing 4xx errors', async () => {
  const { deps } = fakeDeps({
    rpcs: { ...rpcs, request_withdrawal: () => ({ data: null, error: { code: '22023', message: 'The minimum withdrawal is 10 XRP.' } }) },
  });
  const res = await withdraw(post(withdrawal, { Authorization: customer(), 'Idempotency-Key': 'key-00000006' }), deps);
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, 'The minimum withdrawal is 10 XRP.');
});

Deno.test('unexpected database errors are hidden', async () => {
  const { deps } = fakeDeps({ rpcs: { ...rpcs, request_withdrawal: () => ({ data: null, error: { code: 'XX000', message: 'relation secret_internal does not exist' } }) } });
  const res = await withdraw(post(withdrawal, { Authorization: customer(), 'Idempotency-Key': 'key-00000007' }), deps);
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, 'Something went wrong on our side. Try again.');
});

Deno.test('staff decisions run as the staff member, not the service role', async () => {
  const { deps, calls } = fakeDeps({ rpcs: { approval_decide: () => ({ data: { status: 'pending', approvals: 1 }, error: null }) } });
  const res = await approve(post({ approvalId: '30000000-0000-4000-8000-000000000001', decision: 'approve' }, { Authorization: staff('compliance') }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls[0], { fn: 'approval_decide', args: { p_approval: '30000000-0000-4000-8000-000000000001', p_decision: 'approve', p_reason: null, p_note: null }, as: 'user' });
});

Deno.test('auditors and customers cannot decide', async () => {
  const { deps } = fakeDeps();
  const body = { approvalId: '30000000-0000-4000-8000-000000000001', decision: 'approve' };
  assertEquals((await approve(post(body, { Authorization: staff('auditor') }), deps)).status, 403);
  assertEquals((await approve(post(body, { Authorization: `Bearer ${token({ sub: '00000000-0000-4000-8000-000000000042', aal: 'aal2' })}` }), deps)).status, 403);
});

Deno.test('recon-run accepts the scheduler secret and rejects a wrong one', async () => {
  const inputs = {
    omnibus_drops: '1284610250036', customer_liabilities_drops: '1284110250000', suspense_drops: '500000000', validated_ledger: 92417402,
    chain: { rHot: '84210250000', rWarm: '250000000000', rCold: '950400000000' },
    wallets: [{ id: 'cold', tier: 'cold', address: 'rCold' }, { id: 'hot', tier: 'hot', address: 'rHot' }, { id: 'warm', tier: 'warm', address: 'rWarm' }],
    suspense_deposits: [], delayed: [], unbooked_fees: { count: 3, drops: '36' },
  };
  const { deps, calls } = fakeDeps({ rpcs: { recon_inputs: () => ({ data: inputs, error: null }), recon_record: () => ({ data: { id: 'r', ref: 'RC-1' }, error: null }) } });
  assertEquals((await recon(post({}, { 'x-cron-secret': 'nope' }), deps)).status, 401);
  const res = await recon(post({}, { 'x-cron-secret': 'cron-secret-for-tests' }), deps);
  assertEquals(res.status, 200);
  const recorded = calls.find((c) => c.fn === 'recon_record')!;
  assertEquals(recorded.args.p_actor, 'System');
});
