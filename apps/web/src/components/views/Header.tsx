import { Fragment } from 'react';
import type { Vals } from '@/lib/useDashboard';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const Header = ({ v }: { v: Vals }) => (
  <>
    <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', minHeight: '56px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '0' }}>
        {v.isAsset ? (
          <>
            <button type="button" className="link-btn" onClick={v.goOverview} style={{ alignSelf: 'flex-start', margin: '0 0 2px -6px', color: '#4C5A54' }}>
              <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 12H5M11 6l-6 6 6 6"></path>
              </svg>
              Overview
            </button>
          </>
        ) : null}
        <h1 style={{ margin: '0', fontSize: '22px', fontWeight: '600', letterSpacing: '-0.015em' }}>{v.page.title}</h1>
        <p style={{ margin: '0', fontSize: '14px', color: '#4C5A54' }}>{v.page.sub}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {v.demo ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '8px', fontSize: '12.5px', color: '#5F6D66' }}>
            <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5"></circle>
              <path d="M12 11v5M12 8h.01"></path>
            </svg>
            Demo · sample data
          </span>
        ) : null}
        <div style={{ position: 'relative' }}>
          {' '}
          <button type="button" className="icon-btn" aria-label={v.notifLabel} aria-expanded={v.menu.notif} onClick={v.toggleNotif}>
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15z"></path>
              <path d="M10 20.5a2 2 0 0 0 4 0"></path>
            </svg>
            {v.hasUnread ? (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '9px',
                    right: '10px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#B13A2B',
                    boxShadow: '0 0 0 2px #fff',
                  }}
                ></span>
              </>
            ) : null}
          </button>{' '}
          {v.menu.notif ? (
            <>
              {' '}
              <button type="button" className="menu-backdrop" tabIndex={-1} aria-label="Close notifications" onClick={v.closeMenus}></button>{' '}
              <div className="menu" role="region" aria-label="Notifications" onKeyDown={v.onMenuKey} style={{ width: '320px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 6px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '600' }}>Notifications</span>
                  <button type="button" className="link-btn" onClick={v.markRead}>
                    Mark all read
                  </button>
                </div>
                {v.notifications.map((n, index) => (
                  <Fragment key={index}>
                    <div style={{ display: 'flex', gap: '10px', padding: '10px', borderTop: '1px solid #EEF1ED' }}>
                      <span
                        aria-hidden="true"
                        style={{ width: '6px', height: '6px', marginTop: '7px', borderRadius: '50%', flex: 'none', background: n.dot }}
                      ></span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', lineHeight: '1.4' }}>{n.text}</span>
                        <span style={{ fontSize: '12px', color: '#5F6D66' }}>{n.time}</span>
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>{' '}
            </>
          ) : null}{' '}
        </div>
        <div style={{ position: 'relative' }}>
          {' '}
          <button
            type="button"
            className="icon-btn"
            aria-label="Account menu"
            aria-expanded={v.menu.profile}
            onClick={v.toggleProfile}
            style={{ width: 'auto', gap: '6px', padding: '0 8px 0 4px' }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: '#DCE7E2',
                color: '#17453B',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {v.profile.initials}
            </span>
            <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6"></path>
            </svg>
          </button>{' '}
          {v.menu.profile ? (
            <>
              {' '}
              <button type="button" className="menu-backdrop" tabIndex={-1} aria-label="Close account menu" onClick={v.closeMenus}></button>{' '}
              <div className="menu" role="menu" aria-label="Account" onKeyDown={v.onMenuKey}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    padding: '10px 10px 12px',
                    borderBottom: '1px solid #EEF1ED',
                    marginBottom: '4px',
                  }}
                >
                  <span style={{ fontSize: '13.5px', fontWeight: '600' }}>{v.profile.name}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#4C5A54' }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" style={{ fill: 'var(--accent)' }}></circle>
                      <path
                        d="M5 8.2l2 2 4-4.2"
                        style={{ fill: 'none', stroke: '#fff', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round' }}
                      ></path>
                    </svg>
                    {v.profile.verified ? 'Verified account' : 'Not verified yet'}
                  </span>
                </div>
                <button type="button" role="menuitem" className="menu-item" onClick={v.goSettings}>
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="8.5" r="3.5"></circle>
                    <path d="M5 20c1.2-3.4 3.9-5 7-5s5.8 1.6 7 5"></path>
                  </svg>
                  Profile & settings
                </button>
                <button type="button" role="menuitem" className="menu-item" onClick={v.goSettings}>
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3.5l7 2.6v5.4c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.1z"></path>
                  </svg>
                  Security
                </button>
                <button type="button" role="menuitem" className="menu-item" onClick={v.goHelp}>
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5"></circle>
                    <path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.6"></path>
                    <path d="M12 17h.01"></path>
                  </svg>
                  Help & Support
                </button>
                <div style={{ height: '1px', background: '#EEF1ED', margin: '4px 0' }}></div>
                <button type="button" role="menuitem" className="menu-item" onClick={v.signOut}>
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"></path>
                  </svg>
                  Sign out
                </button>
              </div>{' '}
            </>
          ) : null}{' '}
        </div>
      </div>
    </header>
  </>
);
