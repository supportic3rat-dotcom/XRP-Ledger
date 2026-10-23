import { useState } from 'react';
import { Platform, View, type LayoutChangeEvent, type TextLayoutEvent } from 'react-native';
import { T, type TProps } from './T';

/**
 * CSS `text-wrap: balance`. Web uses the native CSS; iOS/Android binary-search the narrowest width that keeps
 * the same number of lines, which is what the CSS algorithm does.
 */
export const BalancedText = (props: TProps) => {
  const [full, setFull] = useState<number | null>(null);
  const [lines, setLines] = useState<number | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  if (Platform.OS === 'web') {
    return <T {...props} style={[props.style, { textWrap: 'balance' } as object]} />;
  }

  const onContainer = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== full) {
      setFull(w);
      setLines(null);
      setRange(null);
      setWidth(null);
    }
  };

  const onTextLayout = (e: TextLayoutEvent) => {
    const n = e.nativeEvent.lines.length;
    if (full === null) return;
    if (lines === null) {
      if (n <= 1) return;
      setLines(n);
      setRange([Math.floor(full / 2), full]);
      setWidth(Math.floor((full / 2 + full) / 2));
      return;
    }
    if (!range) return;
    const [lo, hi] = range;
    const current = width ?? full;
    const next: [number, number] = n > lines ? [current, hi] : [lo, current];
    if (next[1] - next[0] <= 2) {
      setRange(null);
      setWidth(next[1]);
      return;
    }
    setRange(next);
    setWidth(Math.floor((next[0] + next[1]) / 2));
  };

  return (
    <View onLayout={onContainer}>
      <T {...props} onTextLayout={onTextLayout} style={[props.style, width !== null ? { width } : null]} />
    </View>
  );
};
