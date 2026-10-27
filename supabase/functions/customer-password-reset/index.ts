import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

// No look-alike characters (0/O, 1/l/I), so the password reads cleanly in an email.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

const pick = (chars: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => chars[v % chars.length]).join('');

/** Four groups of four (upper, lower, digits, mixed), joined by dashes: strong, and easy to copy from an email. */
export const temporaryPassword = () => [pick(UPPER, 4), pick(LOWER, 4), pick(DIGITS, 4), pick(UPPER + LOWER + DIGITS, 4)].join('-');

/**
 * Compliance sets a new password for a customer who emailed support. Every session is signed out, withdrawals pause
 * for 24 hours, the customer is told to choose their own password, and the reset is audited (all in SQL). The new
 * password is returned once, for Compliance to email back to the address on the account; it's never stored.
 */
export const handler = defineFunction({
  name: 'customer-password-reset',
  schema: fnSchemas['customer-password-reset'],
  access: { kind: 'staff', roles: ['compliance'] },
  run: async (ctx) => {
    const { data: customer } = await ctx.db.from('customers').select('email').eq('id', ctx.input.customerId).maybeSingle();
    const email = (customer as { email: string } | null)?.email;
    if (!email) throw new HttpError(404, 'Customer not found', 'not_found');
    await ctx.rpc('customer_password_reset', { p_customer: ctx.input.customerId }, 'user');
    const password = temporaryPassword();
    const { error } = await ctx.db.auth.admin.updateUserById(ctx.input.customerId, { password });
    if (error) throw new HttpError(400, error.message, 'rejected');
    return { email, password };
  },
});

if (import.meta.main) serve(handler);
