/**
 * The logo (logo.jpg): a wallet outline with the XRP mark and a coin on the clasp, traced to vectors in the
 * source image's pixel space. The glyph spans x 343–943, y 100–590.
 */
export const logo = {
  /** Wallet flap, body and clasp, stroked. */
  outline:
    'M360 196V152Q360 117 395 117H788V196M360 152V573H835Q876 573 876 532V462M876 304V237Q876 196 835 196H360M796 304H908Q926 304 926 322V444Q926 462 908 462H796A79 79 0 0 1 796 304Z',
  /** The XRP mark, filled. */
  mark: 'M425 288H467L522 338Q548 366 574 338L630 288H672L592 352Q548 400 504 352ZM425 490H467L522 434Q548 404 574 434L630 490H672L592 420Q548 372 504 420Z',
  coin: { cx: 805, cy: 383 },
  center: { x: 643, y: 345 },
  width: 600,
  /** Stroke weights. `bold` keeps the coin and mark legible at 32 px and below. */
  weights: {
    regular: { outline: 33, coinR: 44, coin: 11, mark: 0 },
    bold: { outline: 46, coinR: 36, coin: 20, mark: 14 },
  },
} as const;

export type LogoWeight = keyof typeof logo.weights;

/** Geometry for the glyph on a square tile: the glyph takes `fill` of the tile's width; `radius` is the corner as a share of it. */
export const logoTile = (fill = 0.8, radius = 0.25) => {
  const side = logo.width / fill;
  const x = logo.center.x - side / 2;
  const y = logo.center.y - side / 2;
  return { x, y, side, rx: side * radius, viewBox: `${x} ${y} ${side} ${side}` };
};

/** Standalone SVG markup for app icons and favicons. Without `bg` the glyph sits on a transparent square. */
export const logoSvg = ({ fg, bg, weight = 'regular', fill = 0.72, radius = 0.22 }: { fg: string; bg?: string; weight?: LogoWeight; fill?: number; radius?: number }): string => {
  const w = logo.weights[weight];
  const t = logoTile(fill, radius);
  const tile = bg ? `<rect x="${t.x}" y="${t.y}" width="${t.side}" height="${t.side}" rx="${t.rx}" fill="${bg}"/>` : '';
  const markStroke = w.mark ? ` stroke="${fg}" stroke-width="${w.mark}" stroke-linejoin="round"` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${t.viewBox}">${tile}` +
    `<path d="${logo.outline}" fill="none" stroke="${fg}" stroke-width="${w.outline}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${logo.mark}" fill="${fg}"${markStroke}/>` +
    `<circle cx="${logo.coin.cx}" cy="${logo.coin.cy}" r="${w.coinR}" fill="none" stroke="${fg}" stroke-width="${w.coin}"/></svg>`
  );
};
