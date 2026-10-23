import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './T';
import { slopFor } from './hitSlop';

type Option<V extends string> = { value: V; label: string };

/** `.seg` / `.seg-btn` — sunken track, 3px padding, 2px gap; selected button surface with a 1px border ring. aria-pressed. */
export const Segmented = <V extends string>({
  options,
  value,
  onChange,
  label,
  height = 36,
  fontSize = 14,
  style,
}: {
  options: readonly Option<V>[];
  value: V;
  onChange: (v: V) => void;
  label: string;
  /** 36 default, 38 ConnectWallet/LoanManage, 32 phrase length. */
  height?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[{ flexDirection: 'row', gap: 2, padding: 3, borderRadius: 12, backgroundColor: c.sunken }, style]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            hitSlop={slopFor(height)}
            style={{
              flex: 1,
              height,
              borderRadius: 9,
              paddingHorizontal: 6,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? c.surface : 'transparent',
            }}
          >
            {on ? (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: 10, borderWidth: 1, borderColor: c.border }}
              />
            ) : null}
            {/* `.seg-btn` is a <button>: `.m button{font:inherit;color:inherit}` wins, so labels render 14/400 in the text colour. */}
            <T size={fontSize} color="text" align="center">
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
};
