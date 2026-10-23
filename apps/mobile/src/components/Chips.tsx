import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './T';
import { slopFor } from './hitSlop';

/** `.chips` period picker (Home, XRP detail): equal flex, 32 tall, 8 radius; selected = sunken + text. */
export const PeriodChips = <V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly V[];
  value: V;
  onChange: (v: V) => void;
  label: string;
}) => {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o)}
            hitSlop={slopFor(32)}
            style={{
              flex: 1,
              height: 32,
              borderRadius: 8,
              paddingHorizontal: 6,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? c.sunken : 'transparent',
            }}
          >
            {/* <button class="chip">: font and colour inherit (14/400, text). */}
            <T color="text">{o}</T>
          </Pressable>
        );
      })}
    </View>
  );
};

type PillChip = { label: string; on?: boolean; onPress: () => void };

/** Pill chips. `earn`: 36 tall, 18 radius, 13px, selected inverted. `loan`: 34 tall, 17 radius, 12.5px (shortcut chips). */
export const PillChips = ({ chips, variant }: { chips: PillChip[]; variant: 'earn' | 'loan' }) => {
  const { c } = useTheme();
  const h = variant === 'earn' ? 36 : 34;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {chips.map((chip) => (
        <Pressable
          key={chip.label}
          accessibilityRole="button"
          accessibilityState={chip.on === undefined ? undefined : { selected: chip.on }}
          onPress={chip.onPress}
          hitSlop={slopFor(h)}
          style={({ pressed }) => ({
            height: h,
            paddingHorizontal: 12,
            borderRadius: h / 2,
            borderWidth: 1,
            borderColor: chip.on ? c.text : c.borderStrong,
            backgroundColor: chip.on ? c.text : pressed ? c.sunken : c.surface,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <T rawColor={chip.on ? c.bg : c.text}>{chip.label}</T>
        </Pressable>
      ))}
    </View>
  );
};
