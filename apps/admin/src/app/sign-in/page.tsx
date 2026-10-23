import { Brand } from '@/components/Icon';
import { ROLES } from '@/lib/data/types';
import { env, hasBackend } from '@/lib/env';
import { chooseDemoRole } from './actions';
import { SignInForm } from './SignInForm';

export const dynamic = 'force-dynamic';

/** Not in the design: built from the console's card, input and button styles. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <div className="ops" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--bg)' }}>
      <section className="card" style={{ width: '100%', maxWidth: 380, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', padding: 4, borderRadius: 9, background: 'var(--sidebar-bg)' }}>
            <Brand />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>XRP Ledger Ops</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Internal · staff only</span>
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: '-0.015em' }}>Sign in</h1>
        {hasBackend() ? (
          <SignInForm url={env.supabaseUrl} anonKey={env.supabaseAnonKey} reason={reason ?? null} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="banner warn">Demo mode: no Supabase project is connected. Choose a sample staff role.</div>
            {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((r) => (
              <form key={r} action={chooseDemoRole.bind(null, r)}>
                <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
                  {ROLES[r].name}
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
