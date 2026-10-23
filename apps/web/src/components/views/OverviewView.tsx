import { Fragment } from 'react';
import type { Vals } from '@/lib/useDashboard';
import { PerformanceChart } from '../PerformanceChart';
import { CoinLogo } from '../CoinLogo';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const OverviewView = ({ v }: { v: Vals }) => (
  <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        {/* Portfolio balance */}
        <section className="card" aria-labelledby="pf-label" style={{ flex: '999 1 560px', minWidth: '0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '24px 24px 8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0' }}>
              <h2 id="pf-label" style={{ margin: '0', fontSize: '13.5px', fontWeight: '500', color: '#4C5A54' }}>
                Total portfolio value
              </h2>
              {v.state.loading ? (
                <>
                  <div className="skel" style={{ width: '260px', height: '44px', margin: '4px 0' }}></div>
                  <div className="skel" style={{ width: '180px', height: '16px' }}></div>
                </>
              ) : null}
              {v.state.notLoading ? (
                <>
                  <div className="balance num" style={{ fontSize: '42px', fontWeight: '500', letterSpacing: '-0.03em', lineHeight: '1.1' }}>
                    {v.pf.whole}
                    <span style={{ color: '#5F6D66' }}>{v.pf.cents}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}>
                    <span className={`chg ${v.pf.chgCls}`} style={{ fontSize: '13.5px' }}>
                      {v.pf.up ? (
                        <>
                          <svg className="ic ic-xs" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 18V6M7 11l5-5 5 5"></path>
                          </svg>
                        </>
                      ) : null}
                      {v.pf.down ? (
                        <>
                          <svg className="ic ic-xs" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 6v12M7 13l5 5 5-5"></path>
                          </svg>
                        </>
                      ) : null}
                      {v.pf.chgText}
                    </span>
                    <span style={{ color: '#5F6D66' }}>{v.pf.suffix}</span>
                  </div>
                </>
              ) : null}
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
          </div>
          {v.state.error ? (
            <>
              <div style={{ padding: '8px 24px 0' }}>
                {' '}
                <div className="banner error" role="alert">
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ marginTop: '1px' }}>
                    <circle cx="12" cy="12" r="8.5"></circle>
                    <path d="M12 7.8v5M12 16.2h.01"></path>
                  </svg>
                  <span style={{ flex: '1' }}>Couldn’t refresh prices. Values shown are from 12:41 and may be out of date.</span>
                  <button type="button" className="link-btn" onClick={v.retry} style={{ height: '24px', color: '#8E2D21' }}>
                    Retry
                  </button>
                </div>{' '}
              </div>
            </>
          ) : null}
          <div style={{ padding: '12px 24px 4px', flex: '1' }}>
            {' '}
            {v.state.loading ? (
              <>
                {' '}
                <div className="skel" style={{ height: '248px', borderRadius: '8px' }}></div>{' '}
              </>
            ) : null}{' '}
            {v.state.empty ? (
              <>
                {' '}
                <div
                  style={{
                    height: '248px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: '1px dashed #D2D9D4',
                    borderRadius: '10px',
                    textAlign: 'center',
                    padding: '24px',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>No performance to show yet</span>
                  <span style={{ fontSize: '13px', color: '#5F6D66', maxWidth: '320px' }}>
                    Your portfolio chart appears after your first deposit is credited.
                  </span>
                </div>{' '}
              </>
            ) : null}{' '}
            {v.state.hasChart ? (
              <>
                {' '}
                <PerformanceChart points={v.chart.points} height={'220'} accent={v.accent} />{' '}
              </>
            ) : null}{' '}
          </div>
          {/* Primary actions */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '16px 24px 24px',
              borderTop: '1px solid #EEF1ED',
              marginTop: '8px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button type="button" className="btn btn-primary" onClick={v.openReceive}>
                <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4v11M7 10l5 5 5-5"></path>
                  <path d="M5 19.5h14"></path>
                </svg>
                Receive
              </button>
              <button type="button" className="btn btn-secondary" onClick={v.openSend} disabled={v.state.empty}>
                <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 17L17 7M9 7h8v8"></path>
                </svg>
                Send
              </button>
              {v.canBuy ? (
                <button type="button" className="btn btn-secondary" onClick={v.openBuy}>
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5.5" width="18" height="13" rx="2"></rect>
                    <path d="M3 10h18M7 14.5h3"></path>
                  </svg>
                  Buy crypto
                </button>
              ) : null}
            </div>
            <span style={{ fontSize: '12.5px', color: '#5F6D66' }}>Fiat values are indicative, in USD</span>
          </div>
        </section>
        {/* Secondary panel */}
        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '0' }}>
          <section className="card" aria-labelledby="sec-title">
            {' '}
            <div className="card-head" style={{ paddingBottom: '4px' }}>
              <h2 id="sec-title" className="card-title">
                Account security
              </h2>
              <button type="button" className="link-btn" onClick={v.goSettings}>
                Manage
              </button>
            </div>{' '}
            <ul style={{ listStyle: 'none', margin: '0', padding: '4px 20px 16px', display: 'flex', flexDirection: 'column' }}>
              {v.security.map((s, index) => (
                <Fragment key={index}>
                  <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderTop: '1px solid #EEF1ED' }}>
                    {s.ok ? (
                      <>
                        <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#13704C', marginTop: '1px' }}>
                          <circle cx="12" cy="12" r="8.5"></circle>
                          <path d="M8.5 12.2l2.3 2.3 4.7-4.8"></path>
                        </svg>
                      </>
                    ) : null}
                    {s.warn ? (
                      <>
                        <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#875D00', marginTop: '1px' }}>
                          <circle cx="12" cy="12" r="8.5"></circle>
                          <path d="M12 7.8v5M12 16.2h.01"></path>
                        </svg>
                      </>
                    ) : null}
                    {s.neutral ? (
                      <>
                        <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#5F6D66', marginTop: '1px' }}>
                          <circle cx="12" cy="12" r="8.5"></circle>
                          <path d="M12 7.5V12l3 2"></path>
                        </svg>
                      </>
                    ) : null}
                    <span style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '0' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '500' }}>{s.label}</span>
                      <span style={{ fontSize: '12.5px', color: '#5F6D66' }}>{s.value}</span>
                    </span>
                    {s.warn ? (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={v.goSettings} style={{ height: '30px' }}>
                          Set up
                        </button>
                      </>
                    ) : null}
                  </li>
                </Fragment>
              ))}
            </ul>{' '}
          </section>
          <section
            className="card"
            aria-labelledby="learn-title"
            style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#FBFCFA' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500', color: '#4C5A54' }}>
              <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"></path>
                <path d="M5 17a3 3 0 0 1 3-3h9.5"></path>
              </svg>
              Before you deposit
            </span>
            <h2 id="learn-title" className="card-title">
              XRP needs a destination tag
            </h2>
            <p style={{ margin: '0', fontSize: '13px', lineHeight: '1.55', color: '#4C5A54' }}>
              Your XRP deposit address is shared, so every deposit must carry your destination tag. Without it, funds reach us but can’t be matched to your
              account automatically.
            </p>
            <button type="button" className="link-btn" onClick={v.openTagGuide} style={{ alignSelf: 'flex-start', marginLeft: '-6px' }}>
              Read the guide
              <svg className="ic ic-xs" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6"></path>
              </svg>
            </button>
          </section>
        </div>
      </div>
      {/* Holdings + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))', gap: '20px', alignItems: 'start' }}>
        <section className="card" aria-labelledby="assets-title" style={{ overflow: 'hidden' }}>
          {' '}
          <div className="card-head">
            <h2 id="assets-title" className="card-title">
              Assets
            </h2>
            <button type="button" className="link-btn" onClick={v.goMarkets}>
              View all
              <svg className="ic ic-xs" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6"></path>
              </svg>
            </button>
          </div>{' '}
          {v.state.loading ? (
            <>
              {' '}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', padding: '0 20px 12px' }}>
                {v.skeletonRows.map((k, index) => (
                  <Fragment key={index}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '60px', borderTop: '1px solid #EEF1ED' }}>
                      <div className="skel" style={{ width: '32px', height: '32px', borderRadius: '50%' }}></div>
                      <div className="skel" style={{ width: '120px', height: '14px' }}></div>
                      <div className="skel" style={{ width: '80px', height: '14px', marginLeft: 'auto' }}></div>
                    </div>
                  </Fragment>
                ))}
              </div>{' '}
            </>
          ) : null}{' '}
          {v.state.empty ? (
            <>
              {' '}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '28px 20px 32px',
                  borderTop: '1px solid #EEF1ED',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '500' }}>No assets yet</span>
                <span style={{ fontSize: '13px', color: '#5F6D66' }}>Deposit XRP, Bitcoin or Ethereum to see your holdings here.</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={v.openReceive} style={{ marginTop: '6px' }}>
                  Receive crypto
                </button>
              </div>{' '}
            </>
          ) : null}{' '}
          {v.state.hasData ? (
            <>
              {' '}
              <div className="col-head cols-asset" aria-hidden="true">
                <span>Asset</span>
                <span className="r hide-sm">Balance</span>
                <span className="r">Value</span>
                <span className="r">24h</span>
              </div>{' '}
              <div role="list">
                {' '}
                {v.holdings.map((a, index) => (
                  <Fragment key={index}>
                    {' '}
                    <button type="button" role="listitem" className="row cols-asset" onClick={a.open} aria-label={a.aria}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0' }}>
                        <CoinLogo ticker={a.ticker} glyph={a.glyph} color={a.color} />
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>{a.name}</span>
                          <span className="num" style={{ fontSize: '12.5px', color: '#5F6D66' }}>
                            {a.priceText}
                          </span>
                        </span>
                      </span>
                      <span className="num r hide-sm" style={{ fontSize: '13.5px', color: '#4C5A54' }}>
                        {a.qtyText}
                      </span>
                      <span className="num r" style={{ fontSize: '14px', fontWeight: '500' }}>
                        {a.valueText}
                      </span>
                      <span className={`chg ${a.chgCls}`}>
                        {a.up ? (
                          <>
                            <svg className="ic ic-xs" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 18V6M7 11l5-5 5 5"></path>
                            </svg>
                          </>
                        ) : null}
                        {a.down ? (
                          <>
                            <svg className="ic ic-xs" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 6v12M7 13l5 5 5-5"></path>
                            </svg>
                          </>
                        ) : null}
                        {a.chgText}
                      </span>
                    </button>{' '}
                  </Fragment>
                ))}{' '}
              </div>{' '}
            </>
          ) : null}{' '}
        </section>
        <section className="card" aria-labelledby="act-title" style={{ overflow: 'hidden' }}>
          {' '}
          <div className="card-head">
            <h2 id="act-title" className="card-title">
              Recent activity
            </h2>
            <button type="button" className="link-btn" onClick={v.goActivity}>
              View activity
              <svg className="ic ic-xs" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6"></path>
              </svg>
            </button>
          </div>{' '}
          {v.state.loading ? (
            <>
              {' '}
              <div style={{ display: 'flex', flexDirection: 'column', padding: '0 20px 12px' }}>
                {v.skeletonRows.map((k, index) => (
                  <Fragment key={index}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '60px', borderTop: '1px solid #EEF1ED' }}>
                      <div className="skel" style={{ width: '36px', height: '36px', borderRadius: '50%' }}></div>
                      <div className="skel" style={{ width: '140px', height: '14px' }}></div>
                      <div className="skel" style={{ width: '90px', height: '14px', marginLeft: 'auto' }}></div>
                    </div>
                  </Fragment>
                ))}
              </div>{' '}
            </>
          ) : null}{' '}
          {v.state.empty ? (
            <>
              {' '}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '28px 20px 32px',
                  borderTop: '1px solid #EEF1ED',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '500' }}>No activity yet</span>
                <span style={{ fontSize: '13px', color: '#5F6D66' }}>Deposits, withdrawals and exchanges will be listed here.</span>
              </div>{' '}
            </>
          ) : null}{' '}
          {v.state.error ? (
            <>
              {' '}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '28px 20px 32px',
                  borderTop: '1px solid #EEF1ED',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Couldn’t load recent activity</span>
                <span style={{ fontSize: '13px', color: '#5F6D66' }}>Your balances aren’t affected. Try again in a moment.</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={v.retry} style={{ marginTop: '6px' }}>
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 11a8 8 0 1 0-2.3 5.7"></path>
                    <path d="M20 5v6h-6"></path>
                  </svg>
                  Retry
                </button>
              </div>{' '}
            </>
          ) : null}{' '}
          {v.state.live ? (
            <>
              {' '}
              <div role="list">
                {' '}
                {v.recentTxs.map((t, index) => (
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
                        <span style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.title}
                        </span>
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
            </>
          ) : null}{' '}
        </section>
      </div>
    </div>
  </>
);
