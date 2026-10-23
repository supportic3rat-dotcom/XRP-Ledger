import type { ReactNode } from 'react';
import { View } from 'react-native';
import { T } from './T';

/** `.sec` section label: 13/600 text-2, margin top 24 / 22 / 20, sides 4, bottom 8; optional trailing action. */
export const Sec = ({ children, trailing, top = 24 }: { children: ReactNode; trailing?: ReactNode; top?: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: top, marginHorizontal: 4, marginBottom: 8 }}>
    <T size={13} weight={600} color="text2" accessibilityRole="header" style={{ flexShrink: 1 }}>
      {children}
    </T>
    {trailing}
  </View>
);
