import { Fragment } from 'react';
import type { Vals } from '@/lib/useDashboard';
import { PerformanceChart } from '../PerformanceChart';
import { CoinLogo } from '../CoinLogo';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const AssetView = ({ v }: { v: Vals }) => (
  <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <section className="card" aria-labelledby="asset-price-label">
        {' '}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '24px 24px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <CoinLogo ticker={v.asset.ticker} glyph={v.asset.glyph} color={v.asset.color} large />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span id="asset-price-label" style={{ fontSize: '13.5px', fontWeight: '500', color: '#4C5A54' }}>
                {v.asset.name} indicative price
              </span>
              <span className="num" style={{ fontSize: '32px', fontWeight: '500', letterSpacing: '-0.025em', lineHeight: '1.1' }}>
                {v.asset.priceText}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`chg ${v.asset.periodCls}`} style={{ fontSize: '13.5px' }}>
                  {v.asset.periodText}
                </span>
                <span style={{ fontSize: '13.5px', color: '#5F6D66' }}>{v.asset.periodSuffix}</span>
              </span>
            </div>
          </div>
          <div className="seg" role="group" aria-label="Chart period">
            {v.periods.map((p, index) => (
              <Fragment key={index}>
                <button type="button" className={`seg-btn ${p.cls}`} aria-pressed={p.on} onClick={p.pick}>
                  {p.id}
                </button>
              </Fragment>
            ))}
          </div>
        </div>{' '}
        <div style={{ padding: '12px 24px 20px' }}>
          {' '}
          <PerformanceChart points={v.chart.points} height={'220'} accent={v.accent} />{' '}
        </div>{' '}
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))', gap: '20px', alignItems: 'start' }}>
        <section className="card" aria-labelledby="asset-hold-title" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 id="asset-hold-title" className="card-title">
            Your {v.asset.name}
          </h2>
          <dl className="kv" style={{ margin: '0' }}>
            <div className="kv-row">
              <dt>Balance</dt>
              <dd>{v.asset.qtyText}</dd>
            </div>
            <div className="kv-row">
              <dt>Indicative value</dt>
              <dd>{v.asset.valueText}</dd>
            </div>
            <div className="kv-row">
              <dt>24h change</dt>
              <dd>
                <span className={`chg ${v.asset.chgCls}`}>{v.asset.chgText}</span>
              </dd>
            </div>
            <div className="kv-row">
              <dt>Share of portfolio</dt>
              <dd>{v.asset.shareText}</dd>
            </div>
            <div className="kv-row">
              <dt>Network</dt>
              <dd>{v.asset.network}</dd>
            </div>
          </dl>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button type="button" className="btn btn-primary" onClick={v.asset.receive} style={{ flex: '1' }}>
              <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5"></path>
                <path d="M5 19.5h14"></path>
              </svg>
              Receive {v.asset.ticker}
            </button>
            <button type="button" className="btn btn-secondary" onClick={v.asset.send} style={{ flex: '1' }}>
              <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 17L17 7M9 7h8v8"></path>
              </svg>
              Send {v.asset.ticker}
            </button>
          </div>
        </section>
        <section className="card" aria-labelledby="asset-act-title" style={{ overflow: 'hidden' }}>
          {' '}
          <div className="card-head">
            <h2 id="asset-act-title" className="card-title">
              {v.asset.name} activity
            </h2>
            <button type="button" className="link-btn" onClick={v.goActivity}>
              All activity
            </button>
          </div>{' '}
          {v.asset.noTxs ? (
            <>
              {' '}
              <div style={{ padding: '24px 20px 28px', borderTop: '1px solid #EEF1ED', textAlign: 'center', fontSize: '13px', color: '#5F6D66' }}>
                No {v.asset.name} activity yet.
              </div>{' '}
            </>
          ) : null}{' '}
          <div role="list">
            {' '}
            {v.asset.txs.map((t, index) => (
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
                    <span style={{ fontSize: '12.5px', color: '#5F6D66' }}>{t.date}</span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span className="num" style={{ fontSize: '14px', fontWeight: '500', color: t.amountColor }}>
                      {t.amount}
                    </span>
                    <span className={`status ${t.statusCls}`}>{t.statusLabel}</span>
                  </span>
                </button>{' '}
              </Fragment>
            ))}{' '}
          </div>{' '}
        </section>
      </div>
    </div>
  </>
);
