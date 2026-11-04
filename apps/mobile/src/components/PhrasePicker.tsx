import { PHRASE_LENGTH } from '@xrp/schemas';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './T';

/**
 * The security-phrase grid: 30 words, three to a row. Tapping a word adds it to the phrase and shows its place;
 * tapping a picked word takes it out (the words after it move up). Stops at 6.
 */
export const PhrasePicker = ({ words, picked, onChange, invalid }: { words: string[]; picked: string[]; onChange: (next: string[]) => void; invalid?: boolean }) => {
  const { c } = useTheme();
  const full = picked.length >= PHRASE_LENGTH;
  return (
    <View accessibilityLabel={`Security phrase words, ${picked.length} of ${PHRASE_LENGTH} picked`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {words.map((w) => {
        const at = picked.indexOf(w);
        const on = at >= 0;
        return (
          <Pressable
            key={w}
            accessibilityRole="button"
            accessibilityLabel={on ? `${w}, word ${at + 1}` : w}
            accessibilityState={{ selected: on, disabled: full && !on }}
            disabled={full && !on}
            onPress={() => onChange(on ? picked.filter((p) => p !== w) : [...picked, w])}
            style={({ pressed }) => ({
              width: '31.5%',
              flexGrow: 1,
              height: 42,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 10,
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? c.accent : invalid ? c.neg : c.border,
              backgroundColor: on ? c.accentSoft : pressed ? c.sunken : c.surface,
              opacity: full && !on ? 0.45 : 1,
            })}
          >
            {on ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <T size={11} weight={600} color="onAccent" num>
                  {String(at + 1)}
                </T>
              </View>
            ) : null}
            <T size={13.5} weight={on ? 600 : 400}>
              {w}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
};
