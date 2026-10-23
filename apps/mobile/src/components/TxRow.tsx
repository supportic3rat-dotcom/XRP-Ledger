import { coinLogos } from '@xrp/tokens';
import { View } from 'react-native';
import type { TxView } from '@/data/describeTx';
import { useTheme } from '@/theme';
import { CoinLogo } from './CoinLogo';
import { Icon } from './Icon';
import { Row } from './Row';
import { Status } from './Status';
import { T } from './T';

/** `.tx-ic` — the coin's logo with a small badge for the kind of activity; cash flows keep the 36px sunken icon. */
export const TxIcon = ({ icon, asset }: { icon: TxView['icon']; asset?: string }) => {
  const { c } = useTheme();
  if (asset && coinLogos[asset]) {
    return (
      <View style={{ width: 36, height: 36 }}>
        <CoinLogo asset={asset} size={36} />
        <View
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: c.surface,
            backgroundColor: c.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={10} color="text2" strokeWidth={2} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size="sm" color="text2" />
    </View>
  );
};

/** Activity row: icon, title + date, amount + status, chevron. Min height 60 (Home) or 56 (XRP detail). */
export const TxRow = ({ tx, first, onPress, minHeight = 60 }: { tx: TxView; first?: boolean; onPress: () => void; minHeight?: number }) => (
  <Row first={first} minHeight={minHeight} onPress={onPress} accessibilityLabel={tx.aria} chevron>
    <TxIcon icon={tx.icon} asset={tx.asset} />
    <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
      <T weight={500} numberOfLines={1}>
        {tx.title}
      </T>
      <T size={12} color="text3">
        {tx.date}
      </T>
    </View>
    <View style={{ alignItems: 'flex-end', gap: 2 }}>
      <T weight={500} num>
        {tx.amount}
      </T>
      <Status tone={tx.tone} label={tx.status} />
    </View>
  </Row>
);
