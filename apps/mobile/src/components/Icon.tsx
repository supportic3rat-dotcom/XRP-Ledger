import { icons, logo, logoTile, type IconName, type IconShape } from '@xrp/tokens';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme';
import type { ColorToken } from './T';

const sizes = { md: 20, sm: 16, xs: 14 } as const;

type IconProps = {
  name?: IconName;
  /** Raw path data, for icons whose geometry comes from data (e.g. transaction kinds). */
  d?: string;
  size?: keyof typeof sizes | number;
  color?: ColorToken;
  rawColor?: string;
  strokeWidth?: number;
  style?: object;
};

const renderShape = (s: IconShape, i: number) => {
  switch (s.t) {
    case 'path':
      return <Path key={i} d={s.d} />;
    case 'circle':
      return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} />;
    case 'ellipse':
      return <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} />;
    case 'rect':
      return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx ?? 0} />;
  }
};

/** `.ic` — 24 grid, 1.6 stroke, round caps and joins. */
export const Icon = ({ name, d, size = 'md', color = 'text', rawColor, strokeWidth = 1.6, style }: IconProps) => {
  const { c } = useTheme();
  const px = typeof size === 'number' ? size : sizes[size];
  const shapes: IconShape[] = d ? [{ t: 'path', d }] : name ? icons[name] : [];
  return (
    <Svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke={rawColor ?? c[color]}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {shapes.map(renderShape)}
    </Svg>
  );
};

const tile = logoTile();
const weight = logo.weights.bold;

/** The logo (wallet, XRP mark, coin) on an accent tile; inverts with the theme. */
export const BrandMark = ({ size = 28 }: { size?: number }) => {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox={tile.viewBox}>
      <Rect x={tile.x} y={tile.y} width={tile.side} height={tile.side} rx={tile.rx} fill={c.accent} />
      <Path d={logo.outline} fill="none" stroke={c.onAccent} strokeWidth={weight.outline} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={logo.mark} fill={c.onAccent} stroke={c.onAccent} strokeWidth={weight.mark} strokeLinejoin="round" />
      <Circle cx={logo.coin.cx} cy={logo.coin.cy} r={weight.coinR} fill="none" stroke={c.onAccent} strokeWidth={weight.coin} />
    </Svg>
  );
};
