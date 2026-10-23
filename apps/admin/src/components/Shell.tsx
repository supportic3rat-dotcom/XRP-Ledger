import type { IconName } from '@xrp/tokens';
import type { ReactNode } from 'react';
import { ROLES, type Staff } from '@/lib/data/types';
import { Brand } from './Icon';
import { NavList } from './NavList';
import { ToastHost } from './Toast';

export type NavEntry = { href: string; label: string; icon: IconName; count?: number };

/** Black sidebar + main column. Below 760 px the sidebar becomes a horizontal strip (see globals.css). */
export const Shell = ({ me, nav, children }: { me: Staff; nav: NavEntry[]; children: ReactNode }) => (
  <ToastHost>
    <div className="ops" style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh', background: 'var(--bg)' }}>
      <aside
        className="side"
        aria-label="Operations"
        style={{
          flex: '1 1 232px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          padding: '18px 14px',
          background: 'var(--sidebar-bg)',
          color: 'var(--sidebar-fg)',
          minHeight: '100vh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px' }}>
          <Brand />
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>XRP Ledger Ops</span>
            <span style={{ fontSize: 11.5, color: 'var(--sidebar-muted)' }}>Internal · staff only</span>
          </span>
        </div>
        <NavList nav={nav} />
        <details className="me-card" style={{ marginTop: 'auto' }}>
          <summary
            aria-label={`Signed in as ${me.name}, ${ROLES[me.role].name}. Account menu`}
            style={{
              listStyle: 'none',
              cursor: 'pointer',
              padding: 10,
              borderRadius: 10,
              background: 'var(--sidebar-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>You · {ROLES[me.role].name}</span>
            <span style={{ fontSize: 11.5, color: 'var(--sidebar-muted)' }}>{ROLES[me.role].scope}</span>
          </summary>
          <form action="/sign-out" method="post" style={{ marginTop: 6 }}>
            <button type="submit" className="nav-item">
              Sign out · {me.name}
            </button>
          </form>
        </details>
      </aside>
      <main style={{ flex: '999 1 640px', minWidth: 0, padding: '22px 28px 40px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </main>
    </div>
  </ToastHost>
);
