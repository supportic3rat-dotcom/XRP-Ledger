import type { IconName } from '@xrp/tokens';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/Row';
import { Segmented } from '@/components/Segmented';
import { Grab, Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { usePreferences } from '@/state/preferences';
import { ROLES } from '../data/types';
import { useOps, useStaffSession, useStaffSignOut } from '../hooks';
import { OpsScreen } from '../ui';

const MenuRow = ({ icon, label, count, href, first }: { icon: IconName; label: string; count?: number; href: Href; first?: boolean }) => {
  const router = useRouter();
  return (
    <Row first={first} minHeight={52} chevron accessibilityRole="link" onPress={() => router.push(href)} accessibilityLabel={count ? `${label}, ${count} open` : label}>
      <Icon name={icon} color="text2" />
      <T size={15} weight={500} style={{ flex: 1 }}>
        {label}
      </T>
      {count ? (
        <T size={12.5} num weight={500} color="warn">
          {String(count)}
        </T>
      ) : null}
    </Row>
  );
};

export const MoreScreen = () => {
  const { me } = useStaffSession();
  const signOut = useStaffSignOut();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const recon = useOps('recon', (d) => d.recon());
  const exceptions = (recon.data?.exceptions ?? []).filter((e) => e.status !== 'resolved').length;
  const [confirm, setConfirm] = useState(false);

  return (
    <OpsScreen tab title="More" sub="The rest of the console, your account and sign-out.">
      <Card>
        <MenuRow first icon="adminRecon" label="Reconciliation" count={exceptions} href="/ops/reconciliation" />
        <MenuRow icon="markets" label="Assets" href="/ops/assets" />
        <MenuRow icon="shield" label="Custody" href="/ops/custody" />
        <MenuRow icon="adminAudit" label="Audit log" href="/ops/audit" />
      </Card>

      <View>
        <T size={13} weight={600} color="text2" accessibilityRole="header" style={{ marginHorizontal: 4, marginBottom: 8 }}>
          Your account
        </T>
        <Card>
          <Row first minHeight={64}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={15} weight={500}>{`${me.name} · ${ROLES[me.role].name}`}</T>
              <T size={12.5} color="text3">
                {ROLES[me.role].scope}
              </T>
            </View>
          </Row>
          <MenuRow icon="lock" label="Change password" href="/ops/password" />
        </Card>
      </View>

      <View>
        <T size={13} weight={600} color="text2" accessibilityRole="header" style={{ marginHorizontal: 4, marginBottom: 8 }}>
          Appearance
        </T>
        <Segmented
          label="Appearance"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
        />
      </View>

      <Button as="a" label="Sign out" variant="secondary" textColor="neg" onPress={() => setConfirm(true)} style={{ marginTop: 8 }} />

      <Sheet open={confirm} onClose={() => setConfirm(false)} scrim="deep" shadow="strong" accessibilityLabel="Sign out">
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 6 }} accessibilityRole="header">
          Sign out of the console?
        </T>
        <T lh={1.5} color="text2" style={{ marginBottom: 18 }}>
          You’ll need your email and password to sign in again.
        </T>
        <Button label="Sign out" textColor="neg" variant="secondary" onPress={() => void signOut()} />
        <Button label="Cancel" variant="secondary" onPress={() => setConfirm(false)} style={{ marginTop: 10 }} />
      </Sheet>
    </OpsScreen>
  );
};
