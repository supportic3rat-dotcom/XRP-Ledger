import { coinColors, coinLogos } from '@xrp/tokens';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { T } from './T';

/**
 * The coin's real logo (web3icons artwork, clipped to a circle). `USD` and unknown ids get a lettered disc.
 * Decorative: the name or symbol always appears next to it, so it's hidden from screen readers.
 */
export const CoinLogo = ({ asset, size = 36 }: { asset: string; size?: number }) => {
  const xml = coinLogos[asset];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: xml ? 'transparent' : (coinColors[asset] ?? '#5B6B63'),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {xml ? (
        <SvgXml xml={xml} width={size} height={size} />
      ) : (
        <T size={Math.round(size * 0.42)} weight={600} style={{ color: '#fff' }}>
          {asset === 'USD' ? '$' : asset.slice(0, 1)}
        </T>
      )}
    </View>
  );
};
