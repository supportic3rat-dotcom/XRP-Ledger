import type { Vals } from '@/lib/useDashboard';
import { LogoMark } from '@/components/LogoMark';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const Sidebar = ({ v }: { v: Vals }) => (
  <>
    <aside
      className="sidebar"
      aria-label="Primary"
      style={{
        flex: '1 1 240px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        padding: '20px 16px',
        borderRight: '1px solid #E2E6E2',
        background: '#FBFCFA',
        minHeight: '100vh',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 8px' }}>
        <LogoMark />
        <span style={{ fontSize: '15px', fontWeight: '600', letterSpacing: '-0.01em' }}>XRP Ledger</span>
      </div>
      <nav className="nav" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button type="button" className={`nav-item ${v.nav.overview}`} aria-current={v.nav.overviewCur} onClick={v.goOverview}>
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5"></rect>
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.5"></rect>
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.5"></rect>
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.5"></rect>
          </svg>
          Overview
        </button>
        <button type="button" className={`nav-item ${v.nav.activity}`} aria-current={v.nav.activityCur} onClick={v.goActivity}>
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"></path>
          </svg>
          Activity
        </button>
        <button type="button" className={`nav-item ${v.nav.markets}`} aria-current={v.nav.marketsCur} onClick={v.goMarkets}>
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.5 20h17"></path>
            <path d="M5 15.5l4-4.5 3.5 2.5L19 6"></path>
          </svg>
          Markets
        </button>
        <button type="button" className={`nav-item ${v.nav.earn}`} aria-current={v.nav.earnCur} onClick={v.goEarn}>
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
            <ellipse cx="12" cy="6.5" rx="7" ry="2.5"></ellipse>
            <path d="M5 6.5v5.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6.5"></path>
            <path d="M5 12v5.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V12"></path>
          </svg>
          Earn
        </button>
      </nav>
      <div className="side-foot" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button type="button" className={`nav-item ${v.nav.help}`} aria-current={v.nav.helpCur} onClick={v.goHelp}>
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.6"></path>
            <path d="M12 17h.01"></path>
          </svg>
          Help & Support
        </button>
        <button type="button" className={`nav-item ${v.nav.settings}`} aria-current={v.nav.settingsCur} onClick={v.goSettings}>
          <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h9M18 7h2M4 17h3M11 17h9"></path>
            <circle cx="15.5" cy="7" r="2.2"></circle>
            <circle cx="8.5" cy="17" r="2.2"></circle>
          </svg>
          Settings
        </button>
        <div style={{ height: '1px', background: '#E2E6E2', margin: '12px 4px' }}></div>
        <button
          type="button"
          className="account-btn"
          onClick={v.goSettings}
          aria-label={`${v.profile.name}, ${v.profile.verified ? 'verified account' : 'not verified yet'}. Open settings`}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: '#DCE7E2',
              color: '#17453B',
              fontSize: '12.5px',
              fontWeight: '600',
              flex: 'none',
            }}
          >
            {v.profile.initials}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
            <span style={{ fontSize: '13.5px', fontWeight: '600' }}>{v.profile.name}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#4C5A54' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="7" style={{ fill: 'var(--accent)' }}></circle>
                <path d="M5 8.2l2 2 4-4.2" style={{ fill: 'none', stroke: '#fff', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round' }}></path>
              </svg>
              {v.profile.verified ? 'Verified' : 'Not verified'}
            </span>
          </span>
        </button>
      </div>
    </aside>
  </>
);
