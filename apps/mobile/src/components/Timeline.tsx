import { View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './T';

export type TimelineStep = { label: string; note?: string; at?: string; state: 'done' | 'now' | 'bad' | 'skip' | '' };

/** `.tl` — done (filled accent), now (dot-warn ring with warn-soft halo), upcoming (hollow), bad (neg), skip (50%). */
export const Timeline = ({ steps, size = 14, inlineTime }: { steps: TimelineStep[]; size?: number; inlineTime?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ padding: 14 }} accessibilityRole="list">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const dotBorder = s.state === 'done' ? c.accent : s.state === 'now' ? c.dotWarn : s.state === 'bad' ? c.neg : c.borderStrong;
        const dotBg = s.state === 'done' ? c.accent : s.state === 'bad' ? c.neg : c.surface;
        return (
          <View
            key={`${s.label}-${i}`}
            accessibilityLabel={`${s.label}${s.at ? `, ${s.at}` : ''}, ${s.state === 'done' ? 'done' : s.state === 'now' ? 'in progress' : s.state === 'bad' ? 'failed' : 'upcoming'}`}
            style={{ flexDirection: 'row', gap: 12, paddingBottom: last ? 0 : 14, opacity: s.state === 'skip' ? 0.5 : 1 }}
          >
            {!last ? (
              <View style={{ position: 'absolute', left: 7, top: 18, bottom: -2, width: 2, backgroundColor: s.state === 'done' ? c.accent : c.border }} />
            ) : null}
            <View style={{ width: 16, height: 16, marginTop: 1, borderRadius: 8, borderWidth: 2, borderColor: dotBorder, backgroundColor: dotBg }}>
              {s.state === 'now' ? (
                <View style={{ position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 14, borderWidth: 4, borderColor: c.warnSoft }} />
              ) : null}
            </View>
            {inlineTime ? (
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <T size={size} weight={500}>
                  {s.label}
                </T>
                <T size={12} color="text3" num>
                  {s.at ?? ''}
                </T>
              </View>
            ) : (
              <View style={{ flex: 1, gap: 1 }}>
                <T size={size} weight={500}>
                  {s.label}
                </T>
                {s.note ? (
                  <T size={12} color="text3">
                    {s.note}
                  </T>
                ) : null}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};
