import { logo, logoTile } from '@xrp/tokens';

const tile = logoTile();
const weight = logo.weights.bold;

/** The logo (wallet, XRP mark, coin) on an accent tile. */
export const LogoMark = ({ size = 28, tileColor = 'var(--accent)', glyphColor = '#fff' }: { size?: number; tileColor?: string; glyphColor?: string }) => (
  <svg width={size} height={size} viewBox={tile.viewBox} aria-hidden="true" style={{ flex: 'none' }}>
    <rect x={tile.x} y={tile.y} width={tile.side} height={tile.side} rx={tile.rx} style={{ fill: tileColor }} />
    <path d={logo.outline} style={{ fill: 'none', stroke: glyphColor, strokeWidth: weight.outline, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    <path d={logo.mark} style={{ fill: glyphColor, stroke: glyphColor, strokeWidth: weight.mark, strokeLinejoin: 'round' }} />
    <circle cx={logo.coin.cx} cy={logo.coin.cy} r={weight.coinR} style={{ fill: 'none', stroke: glyphColor, strokeWidth: weight.coin }} />
  </svg>
);
