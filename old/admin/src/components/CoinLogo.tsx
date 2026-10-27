import { coinLogos } from '@xrp/tokens';

/** The coin's logo in a circle (decorative; the symbol is always shown next to it). */
export const CoinLogo = ({ asset, size = 20 }: { asset: string; size?: number }) => (
  <span
    aria-hidden="true"
    style={{ display: 'inline-flex', width: size, height: size, borderRadius: '50%', overflow: 'hidden', flex: 'none', background: 'var(--sunken)' }}
    // Static artwork from @xrp/tokens (web3icons), not user input.
    dangerouslySetInnerHTML={{ __html: (coinLogos[asset] ?? '').replace('<svg ', `<svg width="${size}" height="${size}" `).replace(/ width="24" height="24"/, '') }}
  />
);
