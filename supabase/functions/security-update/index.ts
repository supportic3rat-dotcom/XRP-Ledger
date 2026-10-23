import { providerNames } from '@xrp/providers';
import { type FnInput, fnSchemas } from '@xrp/schemas';
import { customerId, sessionId } from '../_shared/customer.ts';
import { type Ctx, defineFunction, serve } from '../_shared/handler.ts';
import { HttpError } from '../_shared/http.ts';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
const CODE_COUNT = 8;

/** 8 alphanumeric backup codes, XXXX-XXXX, from a CSPRNG. */
export const generateBackupCodes = (): string[] =>
  Array.from({ length: CODE_COUNT }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });

type Input = FnInput<'security-update'>;

/** Security screen actions. Turning off the allowlist starts a 24-hour hold. */
export const handler = defineFunction({
  name: 'security-update',
  schema: fnSchemas['security-update'],
  access: { kind: 'customer' },
  run: async (ctx) => {
    const me = customerId(ctx);
    const input = ctx.input;
    switch (input.action) {
      case 'backup-codes': {
        // Codes are stored hashed, so only the count is available after they were first shown.
        const { count } = await ctx.db.from('auth_backup_codes').select('id', { count: 'exact', head: true }).eq('user_id', me).is('used_at', null);
        return { codes: [], unused: count ?? 0 };
      }
      case 'backup-codes-regenerate': {
        const codes = generateBackupCodes();
        await ctx.rpc('set_backup_codes', { p_user: me, p_codes: codes });
        return { codes };
      }
      case 'custody-status': {
        const [health, run, customer] = await Promise.all([
          ctx.providers.custody.health(),
          ctx.db.from('recon_runs').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
          ctx.db.from('customers').select('account_ref').eq('id', me).single(),
        ]);
        return {
          provider: { name: providerNames.custody, ...health },
          reconciledAt: (run.data as { created_at: string } | null)?.created_at ?? null,
          subAccount: (customer.data as { account_ref: string } | null)?.account_ref ?? '',
        };
      }
      case 'mfa-enable': {
        // Enrolment happens in the app (supabase.auth.mfa.enroll + verify). This records it, or cancels a pending turn-off.
        const { data } = await ctx.db.from('customers').select('mfa_disable_at').eq('id', me).single();
        if ((data as { mfa_disable_at: string | null } | null)?.mfa_disable_at) await ctx.rpc('cancel_mfa_disable', { p_customer: me });
        else if (ctx.user?.totpFactorIds.length) await ctx.rpc('security_event', { p_customer: me, p_title: 'Two-factor turned on' });
        return { ok: true };
      }
      case 'mfa-disable': {
        const at = await ctx.rpc<string>('request_mfa_disable', { p_customer: me });
        return { ok: true, effectiveAt: at };
      }
      case 'allowlist-toggle': {
        await ctx.rpc('set_allowlist', { p_customer: me, p_enabled: input.enabled });
        return { ok: true };
      }
      case 'password-change': {
        const email = ctx.user?.email;
        if (!email || !(await ctx.auth.checkPassword(email, input.current))) {
          throw new HttpError(400, 'Your current password isn’t right.', 'bad_password');
        }
        if (input.current === input.next) throw new HttpError(400, 'Choose a password you haven’t used here before.', 'same_password');
        const { error } = await ctx.db.auth.admin.updateUserById(me, { password: input.next });
        if (error) throw new HttpError(400, error.message, 'rejected');
        await ctx.rpc('password_changed', { p_customer: me, p_current_session: sessionId(ctx) });
        return { ok: true };
      }
    }
  },
});

if (import.meta.main) serve(handler);
