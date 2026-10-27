import type { Vals } from '@/lib/useDashboard';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const EarnView = ({ v }: { v: Vals }) => (
  <>
    <section
      className="card"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '56px 24px', textAlign: 'center' }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: '#F0F3EF',
          color: '#4C5A54',
        }}
      >
        <svg className="ic" viewBox="0 0 24 24">
          <ellipse cx="12" cy="6.5" rx="7" ry="2.5"></ellipse>
          <path d="M5 6.5v5.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6.5"></path>
          <path d="M5 12v5.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V12"></path>
        </svg>
      </span>
      <h2 style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: '600' }}>No Earn programs are available</h2>
      <p style={{ margin: '0', maxWidth: '420px', fontSize: '13.5px', lineHeight: '1.55', color: '#4C5A54' }}>
        XRP Flexible yield is offered in the mobile app, with its terms, risks and how rewards are calculated. When a program is available here, those details
        will appear first.
      </p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={v.goOverview} style={{ marginTop: '8px' }}>
        Back to overview
      </button>
    </section>
  </>
);
