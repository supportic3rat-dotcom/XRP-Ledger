import { Fragment } from 'react';
import type { Vals } from '@/lib/useDashboard';
import { CoinLogo } from '../CoinLogo';

/** Ported from Main.dc.html by tools/dc2jsx.py, then edited by hand. */
export const MarketsView = ({ v }: { v: Vals }) => (
  <>
    <section className="card" aria-labelledby="mk-title" style={{ overflow: 'hidden' }}>
      {' '}
      <div className="card-head">
        <h2 id="mk-title" className="card-title">
          Supported assets
        </h2>
        <span style={{ fontSize: '12.5px', color: '#5F6D66' }}>Indicative prices · USD</span>
      </div>{' '}
      <div className="col-head cols-market" aria-hidden="true">
        <span>Asset</span>
        <span className="r">Price</span>
        <span className="r">24h</span>
        <span className="r hide-sm">You hold</span>
        <span></span>
      </div>{' '}
      <div role="list">
        {' '}
        {v.markets.map((m, index) => (
          <Fragment key={index}>
            {' '}
            {m.held ? (
              <>
                {' '}
                <button type="button" role="listitem" className="row cols-market" onClick={m.open} aria-label={m.aria}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0' }}>
                    <CoinLogo ticker={m.ticker} glyph={m.glyph} color={m.color} />
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '500' }}>{m.name}</span>
                      <span style={{ fontSize: '12.5px', color: '#5F6D66' }}>{m.ticker}</span>
                    </span>
                  </span>
                  <span className="num r" style={{ fontWeight: '500' }}>
                    {m.priceText}
                  </span>
                  <span className={`chg ${m.chgCls}`}>{m.chgText}</span>
                  <span className="num r hide-sm" style={{ color: '#4C5A54' }}>
                    {m.holdText}
                  </span>
                  <svg className="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" style={{ color: '#5F6D66' }}>
                    <path d="M9 6l6 6-6 6"></path>
                  </svg>
                </button>{' '}
              </>
            ) : null}{' '}
            {m.notHeld ? (
              <>
                {' '}
                <div role="listitem" className="row static cols-market">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0' }}>
                    <CoinLogo ticker={m.ticker} glyph={m.glyph} color={m.color} />
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '500' }}>{m.name}</span>
                      <span style={{ fontSize: '12.5px', color: '#5F6D66' }}>{m.ticker}</span>
                    </span>
                  </span>
                  <span className="num r" style={{ fontWeight: '500' }}>
                    {m.priceText}
                  </span>
                  <span className={`chg ${m.chgCls}`}>{m.chgText}</span>
                  <span className="r hide-sm" style={{ color: '#5F6D66' }}>
                    —
                  </span>
                  <span></span>
                </div>{' '}
              </>
            ) : null}{' '}
          </Fragment>
        ))}{' '}
      </div>{' '}
    </section>
  </>
);
