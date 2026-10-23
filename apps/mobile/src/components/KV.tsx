import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { T, type ColorToken } from './T';

export type KVItem = {
  k: ReactNode;
  v: ReactNode;
  mono?: boolean;
  sub?: string;
  total?: boolean;
  valueColor?: ColorToken;
  valueSize?: number;
  valueWeight?: 400 | 500 | 600;
  keyStrong?: boolean;
};

/** `.kv` — label left in text-3, value right (500, tabular), rows divided by borders. */
/** `num`: the screen's `.kv dd` uses tabular figures (Borrow, Custody, Earn, Exchange, Manage loan, Withdraw). */
/** `fixedKeys`: the screen's `.kv dt` is `flex:none` (XRP detail, Home, Legal, Manage loan), so long values wrap instead of labels. */
export const KV = ({
  items,
  rowPad = 11,
  padX = 14,
  padY = 2,
  baseline = true,
  num = false,
  fixedKeys = false,
  style,
}: {
  items: KVItem[];
  rowPad?: number;
  padX?: number;
  padY?: number;
  baseline?: boolean;
  num?: boolean;
  fixedKeys?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const { c } = useTheme();
  return (
    <View style={[{ paddingVertical: padY, paddingHorizontal: padX }, style]}>
      {items.map((item, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: baseline ? 'baseline' : 'flex-start',
            gap: 16,
            paddingVertical: rowPad,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: c.border,
          }}
        >
          <View style={{ flexShrink: fixedKeys ? 0 : 1 }}>
            {typeof item.k === 'string' ? (
              <T size={item.total ? 14.5 : 13.5} weight={item.total || item.keyStrong ? 600 : 400} color={item.total || item.keyStrong ? 'text' : 'text3'}>
                {item.k}
              </T>
            ) : (
              item.k
            )}
            {item.sub ? (
              <T size={11.5} color="text3">
                {item.sub}
              </T>
            ) : null}
          </View>
          {typeof item.v === 'string' ? (
            <T
              size={item.valueSize ?? (item.total ? 14.5 : 13.5)}
              weight={item.valueWeight ?? 500}
              mono={item.mono}
              num={num && !item.mono}
              color={item.valueColor ?? 'text'}
              align="right"
              style={{ flexShrink: 1 }}
            >
              {item.v}
            </T>
          ) : (
            <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{item.v}</View>
          )}
        </View>
      ))}
    </View>
  );
};
