import { Fragment } from 'react';
import type { ChartVals } from './useChart';

/** Ported from PerformanceChart.dc.html by tools/dc2jsx.py, then edited by hand. */
export const ChartMarkup = ({ v }: { v: ChartVals }) => (
  <>
    <div
      style={{
        position: 'relative',
        width: '100%',
        padding: '8px 68px 0 0',
        boxSizing: 'border-box',
        fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
        color: '#17211D',
        fontVariantNumeric: 'tabular-nums',
        background: '#FFFFFF',
      }}
    >
      {' '}
      <div role="img" aria-label={v.aria} style={{ position: 'relative', height: `${v.h}px` }}>
        {' '}
        {v.ticks.map((t, index) => (
          <Fragment key={index}>
            {' '}
            <div aria-hidden="true" style={{ position: 'absolute', left: '0', right: '-4px', top: `${t.top}%`, borderTop: '1px solid #EDF0EC' }}></div>{' '}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: '-68px',
                width: '60px',
                top: `${t.top}%`,
                transform: 'translateY(-50%)',
                textAlign: 'right',
                fontSize: '11px',
                color: '#5F6D66',
                opacity: t.opacity,
              }}
            >
              {t.label}
            </div>{' '}
          </Fragment>
        ))}{' '}
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'visible' }}
        >
          <path d={v.area} style={{ fill: v.accent, fillOpacity: '0.06', stroke: 'none' }}></path>
          <path
            d={v.line}
            style={{ fill: 'none', stroke: v.accent, strokeWidth: '2px', strokeLinejoin: 'round', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' }}
          ></path>
        </svg>{' '}
        {/* current value: dashed guide, marker and value tag in the axis gutter */}{' '}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '0', right: '-4px', top: `${v.end.top}%`, borderTop: `1px dashed ${v.accent}`, opacity: '0.35' }}
        ></div>{' '}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '100%',
            top: `${v.end.top}%`,
            width: '10px',
            height: '10px',
            margin: '-5px 0 0 -5px',
            borderRadius: '50%',
            background: v.accent,
            boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 6px rgba(0,0,0,0.12)',
          }}
        ></div>{' '}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '-68px',
            top: `${v.end.top}%`,
            transform: 'translateY(-50%)',
            minWidth: '60px',
            padding: '3px 6px',
            borderRadius: '6px',
            background: v.accent,
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          {v.end.label}
        </div>{' '}
        {v.hover.on ? (
          <>
            {' '}
            <div
              aria-hidden="true"
              style={{ position: 'absolute', top: '0', bottom: '0', left: `${v.hover.left}%`, borderLeft: '1px solid #C9D1CB' }}
            ></div>{' '}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: `${v.hover.left}%`,
                top: `${v.hover.top}%`,
                width: '9px',
                height: '9px',
                margin: '-4.5px 0 0 -4.5px',
                borderRadius: '50%',
                background: '#FFFFFF',
                border: `2px solid ${v.accent}`,
                boxSizing: 'border-box',
              }}
            ></div>{' '}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '0',
                left: `${v.hover.left}%`,
                transform: `translateX(${v.hover.tx})`,
                margin: '0 8px',
                padding: '6px 10px',
                background: '#FFFFFF',
                border: '1px solid #E2E6E2',
                borderRadius: '8px',
                boxShadow: '0 4px 12px -4px rgba(23,33,29,0.14)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {' '}
              <div style={{ fontSize: '13px', fontWeight: '600' }}>{v.hover.value}</div>{' '}
              <div style={{ fontSize: '11.5px', color: '#5F6D66' }}>{v.hover.tip}</div>{' '}
            </div>{' '}
          </>
        ) : null}{' '}
        <div aria-hidden="true" onMouseMove={v.onMove} onMouseLeave={v.onLeave} style={{ position: 'absolute', inset: '0', cursor: 'crosshair' }}></div>{' '}
      </div>{' '}
      <div aria-hidden="true" style={{ position: 'relative', height: '28px' }}>
        {' '}
        {v.xlabels.map((x, index) => (
          <Fragment key={index}>
            {' '}
            <span
              style={{
                position: 'absolute',
                top: '9px',
                left: `${x.left}%`,
                transform: `translateX(${x.tx})`,
                fontSize: '11px',
                color: '#5F6D66',
                whiteSpace: 'nowrap',
              }}
            >
              {x.text}
            </span>{' '}
          </Fragment>
        ))}{' '}
      </div>{' '}
    </div>
  </>
);
