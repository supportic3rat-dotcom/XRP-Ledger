import { coinLogos } from '@xrp/tokens';

/** The coin's real logo in the design's `.glyph` circle; falls back to the letter glyph on its colour. */
export const CoinLogo = ({ ticker, glyph, color, large }: { ticker: string; glyph: string; color: string; large?: boolean }) => {
  const svg = coinLogos[ticker];
  const size = large ? 44 : 32;
  return svg ? (
    <span
      className={`glyph${large ? ' lg' : ''}`}
      aria-hidden="true"
      style={{ overflow: 'hidden', background: 'transparent' }}
      // Static artwork from @xrp/tokens (web3icons), not user input.
      dangerouslySetInnerHTML={{ __html: svg.replace(' width="24" height="24"', ` width="${size}" height="${size}"`) }}
    />
  ) : (
    <span className={`glyph${large ? ' lg' : ''}`} aria-hidden="true" style={{ background: color }}>
      {glyph}
    </span>
  );
};
