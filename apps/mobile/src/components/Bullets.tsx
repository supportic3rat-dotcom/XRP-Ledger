import { View } from 'react-native';
import { T } from './T';

/** `ul` with `padding-left:18px`, disc markers, list gap. */
export const Bullets = ({
  items,
  size = 13.5,
  gap = 10,
  lh = 1.5,
  color = 'text2' as const,
}: {
  items: string[];
  size?: number;
  gap?: number;
  lh?: number;
  color?: 'text2';
}) => (
  <View style={{ gap }} accessibilityRole="list">
    {items.map((item) => (
      <View key={item} style={{ flexDirection: 'row' }}>
        <View style={{ width: 18, alignItems: 'flex-end', paddingRight: 7 }}>
          <T size={size} lh={lh} color={color}>
            •
          </T>
        </View>
        <T size={size} lh={lh} color={color} style={{ flex: 1 }}>
          {item}
        </T>
      </View>
    ))}
  </View>
);
