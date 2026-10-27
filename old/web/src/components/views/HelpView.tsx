import { Fragment } from 'react';
import type { Vals } from '@/lib/useDashboard';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const HelpView = ({ v }: { v: Vals }) => (
  <>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
      <section className="card" aria-labelledby="help-guides" style={{ flex: '999 1 520px', minWidth: '0', overflow: 'hidden' }}>
        {' '}
        <div className="card-head">
          <h2 id="help-guides" className="card-title">
            Guides
          </h2>
        </div>{' '}
        {v.guides.map((g, index) => (
          <Fragment key={index}>
            {' '}
            <div>
              {' '}
              <button type="button" className="accordion-btn" aria-expanded={g.open} onClick={g.toggle}>
                {g.title}
                <svg className="ic ic-sm chev" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6"></path>
                </svg>
              </button>{' '}
              {g.open ? (
                <>
                  {' '}
                  <p style={{ margin: '0', padding: '0 20px 16px', fontSize: '13.5px', lineHeight: '1.6', color: '#4C5A54', maxWidth: '640px' }}>
                    {g.body}
                  </p>{' '}
                </>
              ) : null}{' '}
            </div>{' '}
          </Fragment>
        ))}{' '}
      </section>
      <section
        className="card"
        aria-labelledby="help-contact"
        style={{ flex: '1 1 280px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}
      >
        <h2 id="help-contact" className="card-title">
          Contact support
        </h2>
        <p style={{ margin: '0', fontSize: '13.5px', lineHeight: '1.55', color: '#4C5A54' }}>
          Support will never ask for your password, two-factor codes or a recovery phrase.
        </p>
        <button type="button" className="btn btn-primary" onClick={v.contactSupport} style={{ alignSelf: 'flex-start' }}>
          Message support
        </button>
      </section>
    </div>
  </>
);
