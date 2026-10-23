import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BalancedText } from '@/components/Balanced';
import { Button } from '@/components/Button';
import { Bullets } from '@/components/Bullets';
import { BrandMark, Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Grab, Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { useTheme } from '@/theme';
import type { IconName } from '@xrp/tokens';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'shield', title: 'Institutional custody', body: 'Keys stay with a disclosed custody provider — never on your phone.' },
  { icon: 'earn', title: 'Yield on crypto assets', body: 'Only products with published rates, terms and risks.' },
  { icon: 'borrow', title: 'Borrow against crypto', body: 'See LTV and liquidation price before you apply.' },
];

const CUSTODIAL_POINTS = [
  'Your assets are held by the platform through its disclosed custody provider, not in a wallet you control.',
  'You access them by signing in. There’s no recovery phrase, and we’ll never ask you for one.',
  'Withdrawals are reviewed before they’re sent, so they aren’t instant.',
  'You depend on the platform and its providers staying solvent and available. Read the Custody Agreement and Risk Disclosure before depositing.',
];

export const WelcomeScreen = () => {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false);

  return (
    <Screen>
      <View style={{ flex: 1, paddingTop: insets.top + 56, paddingHorizontal: 24, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BrandMark size={32} />
          <T size={17} weight={600} ls={-0.01}>
            XRP Ledger
          </T>
        </View>

        <View style={{ marginTop: 56, gap: 12 }}>
          <BalancedText size={30} weight={600} lh={1.15} ls={-0.025} accessibilityRole="header">
            One custodial wallet for Bitcoin, Ethereum, XRP and more — with yield and borrowing built in.
          </BalancedText>
          <T size={15} lh={1.5} color="text2">
            Hold 18 major coins with institutional custody, earn yield on them, or borrow against them — with live prices and every request tracked from submission to settlement.
          </T>
        </View>

        <View style={{ marginTop: 32, gap: 18 }}>
          {POINTS.map((p) => (
            <View key={p.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={p.icon} color="accentText" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T weight={600}>{p.title}</T>
                <T size={13} color="text2">
                  {p.body}
                </T>
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 'auto', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="This is a custodial service. What that means"
            onPress={() => setSheet(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 10,
              backgroundColor: pressed ? c.sunken : c.surface,
            })}
          >
            <Icon name="info" size="sm" color="text3" />
            <T size={12.5} color="text2" style={{ flex: 1 }}>
              This is a custodial service.{' '}
              <T size={12.5} weight={600}>
                What that means
              </T>
            </T>
            <Icon name="chevronRight" size="sm" color="text3" />
          </Pressable>
          <Button as="a" label="Create account" onPress={() => router.push('/create-account')} />
          <Button as="a" label="Connect an existing wallet" variant="secondary" onPress={() => router.push('/connect-wallet')} />
          <Pressable accessibilityRole="link" onPress={() => router.push('/sign-in')} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T weight={500} color="accentText">
              I already have an account · Sign in
            </T>
          </Pressable>
          <T size={12} lh={1.5} color="text3" align="center" style={{ marginTop: 6 }}>
            By continuing you agree to the{' '}
            <T size={12.5} lh={1.44} color="accentText" underline onPress={() => router.push('/legal')} accessibilityRole="link">
              Terms of Service
            </T>{' '}
            and{' '}
            <T size={12.5} lh={1.44} color="accentText" underline onPress={() => router.push('/legal')} accessibilityRole="link">
              Privacy Policy
            </T>{' '}
            (draft v0.1). Not affiliated with Ripple or the XRP Ledger Foundation.
          </T>
        </View>
      </View>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        scrim="green"
        shadow="soft"
        maxHeight={null}
        paddingX={20}
        accessibilityLabel="What a custodial account means"
      >
        <Grab bottom={16} />
        <T size={18} weight={600} style={{ marginBottom: 12 }} accessibilityRole="header">
          What a custodial account means
        </T>
        <Bullets items={CUSTODIAL_POINTS} />
        <Button label="Got it" variant="secondary" onPress={() => setSheet(false)} style={{ marginTop: 20 }} />
      </Sheet>
    </Screen>
  );
};
