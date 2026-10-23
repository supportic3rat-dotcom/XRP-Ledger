import { type IconName, icons, logo, logoTile } from '@xrp/tokens';
import type { CSSProperties } from 'react';

/** Icons from packages/tokens, drawn with the design's `.ic` stroke style. */
export const Icon = ({ name, small, style }: { name: IconName; small?: boolean; style?: CSSProperties }) => (
  <svg className={small ? 'ic ic-sm' : 'ic'} viewBox="0 0 24 24" aria-hidden="true" style={style}>
    {icons[name].map((s, i) => {
      switch (s.t) {
        case 'path':
          return <path key={i} d={s.d} />;
        case 'circle':
          return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />;
        case 'ellipse':
          return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} />;
        case 'rect':
          return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} />;
      }
    })}
  </svg>
);

const tile = logoTile();
const weight = logo.weights.bold;

/** The logo on the sidebar: a sidebar-fg tile with the glyph in sidebar-bg. */
export const Brand = () => (
  <svg width="26" height="26" viewBox={tile.viewBox} aria-hidden="true">
    <rect x={tile.x} y={tile.y} width={tile.side} height={tile.side} rx={tile.rx} style={{ fill: 'var(--sidebar-fg)' }} />
    <path d={logo.outline} style={{ fill: 'none', stroke: 'var(--sidebar-bg)', strokeWidth: weight.outline, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <path d={logo.mark} style={{ fill: 'var(--sidebar-bg)', stroke: 'var(--sidebar-bg)', strokeWidth: weight.mark, strokeLinejoin: 'round' }} />
    <circle cx={logo.coin.cx} cy={logo.coin.cy} r={weight.coinR} style={{ fill: 'none', stroke: 'var(--sidebar-bg)', strokeWidth: weight.coin }} />
  </svg>
);
