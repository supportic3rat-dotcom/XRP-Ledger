import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

/** A staff member changes their own password. Other sessions are signed out and the change is audited. */
export const handler = defineFunction({
  name: 'staff-password-change',
  schema: fnSchemas['staff-password-change'],
  access: { kind: 'staff' },
  run: async (ctx) => {
    const email = ctx.user?.email;
    const me = ctx.userId;
    if (!me) throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
    if (!email || !(await ctx.auth.checkPassword(email, ctx.input.current))) {
      throw new HttpError(400, 'Your current password isn’t right.', 'bad_password');
    }
    if (ctx.input.current === ctx.input.next) throw new HttpError(400, 'Choose a password you haven’t used here before.', 'same_password');
    const { error } = await ctx.db.auth.admin.updateUserById(me, { password: ctx.input.next });
    if (error) throw new HttpError(400, error.message, 'rejected');
    // Anyone else signed in with the old password is signed out; this phone stays signed in.
    const jwt = ctx.authorization?.replace(/^Bearer\s+/i, '');
    if (jwt) await ctx.db.auth.admin.signOut(jwt, 'others').catch(() => undefined);
    const { data: staff } = await ctx.db.from('staff_roles').select('display_name, role').eq('staff_id', me).single();
    const row = staff as { display_name: string; role: string } | null;
    await ctx.rpc('audit', {
      p_actor_type: 'staff',
      p_actor_id: me,
      p_actor_name: row?.display_name ?? 'Staff',
      p_role: row?.role ?? ctx.claims?.app_role ?? '',
      p_action: 'Changed own password',
      p_target: 'Account',
    });
    return { ok: true };
  },
});

if (import.meta.main) serve(handler);
