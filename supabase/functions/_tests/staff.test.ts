import { assertEquals } from 'jsr:@std/assert@1';
import { isStrongPassword } from '@xrp/schemas';
import { handler as resetPassword, temporaryPassword } from '../customer-password-reset/index.ts';
import { handler as staffPassword } from '../staff-password-change/index.ts';
import { CUSTOMER, fakeDeps, post, token } from './fakes.ts';

const STAFF_ID = '00000000-0000-4000-9000-00000000a001';
const staff = (role: string) => `Bearer ${token({ sub: STAFF_ID, app_role: role, aal: 'aal1' })}`;
const body = { current: 'Old-Password-2026', next: 'New-Password-2026' };

Deno.test('staff change their own password, other sessions end, and it is audited', async () => {
  const { deps, calls } = fakeDeps({ password: 'Old-Password-2026', tables: { staff_roles: [{ display_name: 'XRP Support', role: 'operations' }] } });
  const res = await staffPassword(post(body, { Authorization: staff('operations') }), deps);
  assertEquals(res.status, 200);
  assertEquals(calls[0], { fn: 'auth.admin.updateUserById', args: { id: STAFF_ID, password: 'New-Password-2026' }, as: 'service' });
  assertEquals(calls[1], { fn: 'auth.admin.signOut', args: { scope: 'others' }, as: 'service' });
  assertEquals(calls[2]?.fn, 'audit');
  assertEquals(calls[2]?.args.p_action, 'Changed own password');
});

Deno.test('a wrong current password changes nothing', async () => {
  const { deps, calls } = fakeDeps({ password: 'Old-Password-2026' });
  const res = await staffPassword(post({ ...body, current: 'Not-It-2026' }, { Authorization: staff('compliance') }), deps);
  assertEquals(res.status, 400);
  assertEquals(calls.length, 0);
});

Deno.test('a weak new password is refused before anything runs', async () => {
  const { deps, calls } = fakeDeps();
  const res = await staffPassword(post({ ...body, next: 'short' }, { Authorization: staff('operations') }), deps);
  assertEquals(res.status, 400);
  assertEquals(calls.length, 0);
});

Deno.test('customers cannot use the staff password function', async () => {
  const { deps } = fakeDeps();
  const res = await staffPassword(post(body, { Authorization: `Bearer ${token({ sub: CUSTOMER, aal: 'aal1' })}` }), deps);
  assertEquals(res.status, 403);
});

Deno.test('a reset password is strong, readable and different every time', () => {
  const a = temporaryPassword();
  const b = temporaryPassword();
  assertEquals(isStrongPassword(a), true);
  assertEquals(/^[A-Z]{4}-[a-z]{4}-[2-9]{4}-[A-Za-z2-9]{4}$/.test(a), true);
  assertEquals(/[01OIl]/.test(a.replaceAll('-', '')), false);
  assertEquals(a === b, false);
});

Deno.test('only Compliance can reset a customer password', async () => {
  const { deps } = fakeDeps({});
  const res = await resetPassword(post({ customerId: CUSTOMER }, { Authorization: staff('operations') }), deps);
  assertEquals(res.status, 403);
});
