import type { IconName } from '@xrp/tokens';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { IconButton } from './IconButton';
import { T } from './T';

type TopBarProps = {
  /** Centred 17/600 title. */
  title?: string;
  /** Centred 13px text-3 label (onboarding steps), offset by 44 so it centres on the screen. */
  label?: string;
  leading?: 'back' | 'close' | 'none';
  leadingLabel?: string;
  onLeading?: () => void;
  trailing?: ReactNode;
  /** `.topbar` bottom margin: 8, or 4 on Withdraw and Identity capture. */
  marginBottom?: number;
};

/** `.topbar` — min-height 48, gap 8, −4 side margins. */
export const TopBar = ({ title, label, leading = 'back', leadingLabel, onLeading, trailing, marginBottom = 8 }: TopBarProps) => {
  const router = useRouter();
  const icon: IconName = leading === 'close' ? 'close' : 'back';
  const onPress = onLeading ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginHorizontal: -4, marginBottom }}>
      {leading !== 'none' ? <IconButton icon={icon} label={leadingLabel ?? (leading === 'close' ? 'Close' : 'Back')} onPress={onPress} /> : null}
      {title !== undefined ? (
        <T size={17} weight={600} align="center" style={{ flex: 1 }} accessibilityRole="header" numberOfLines={1}>
          {title}
        </T>
      ) : null}
      {label !== undefined ? (
        <T size={13} color="text3" align="center" style={{ flex: 1, marginRight: 44 }}>
          {label}
        </T>
      ) : null}
      {title !== undefined ? (trailing ?? <View style={{ width: 44 }} />) : trailing}
    </View>
  );
};
