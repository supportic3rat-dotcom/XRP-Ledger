import { Fragment } from 'react';
import type { Vals } from '@/lib/useDashboard';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const ActivityView = ({ v }: { v: Vals }) => (
  <>
    <section className="card" aria-labelledby="all-act-title" style={{ overflow: 'hidden' }}>
      {' '}
      <div className="card-head" style={{ flexWrap: 'wrap' }}>
        <h2 id="all-act-title" className="card-title">
          All transactions
        </h2>
        <div className="seg" role="group" aria-label="Filter transactions">
          {v.filters.map((f, index) => (
            <Fragment key={index}>
              <button type="button" className={`seg-btn ${f.cls}`} aria-pressed={f.on} onClick={f.pick}>
                {f.label}
              </button>
            </Fragment>
          ))}
        </div>
      </div>{' '}
      {v.noFilteredTxs ? (
        <>
          {' '}
          <div style={{ padding: '32px 20px', borderTop: '1px solid #EEF1ED', textAlign: 'center', fontSize: '13px', color: '#5F6D66' }}>
            No transactions match this filter.
          </div>{' '}
        </>
      ) : null}{' '}
      <div role="list">
        {' '}
        {v.filteredTxs.map((t, index) => (
          <Fragment key={index}>
            {' '}
            <button type="button" role="listitem" className="row cols-tx" onClick={t.open} aria-label={t.aria}>
              <span className="tx-ic" aria-hidden="true">
                {t.isReceive ? (
                  <>
                    <svg className="ic ic-sm" viewBox="0 0 24 24">
                      <path d="M17 7L7 17M15 17H7V9"></path>
                    </svg>
                  </>
                ) : null}
                {t.isSend ? (
                  <>
                    <svg className="ic ic-sm" viewBox="0 0 24 24">
                      <path d="M7 17L17 7M9 7h8v8"></path>
                    </svg>
                  </>
                ) : null}
                {t.isExchange ? (
                  <>
                    <svg className="ic ic-sm" viewBox="0 0 24 24">
                      <path d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5"></path>
                    </svg>
                  </>
                ) : null}
                {t.isBuy ? (
                  <>
                    <svg className="ic ic-sm" viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14"></path>
                    </svg>
                  </>
                ) : null}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '0' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                <span style={{ fontSize: '12.5px', color: '#5F6D66' }}>
                  {t.date} · {t.network}
                </span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span className="num" style={{ fontSize: '14px', fontWeight: '500', color: t.amountColor }}>
                  {t.amount}
                </span>
                <span className="num" style={{ fontSize: '12.5px', color: '#5F6D66' }}>
                  {t.fiat}
                </span>
              </span>
            </button>{' '}
          </Fragment>
        ))}{' '}
      </div>{' '}
    </section>
  </>
);
