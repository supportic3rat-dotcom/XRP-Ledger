import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { biometricName, confirmWithDevice } from '@/lib/deviceAuth';
import { usePreferences } from '@/state/preferences';
import { Row } from './Row';
import { T } from './T';
import { Toggle } from './Toggle';

/** "Unlock with Face ID" switch. Hidden on phones without Face ID or a fingerprint set up. Turning it on asks once, to prove it works. */
export const AppLockToggle = ({ first }: { first?: boolean }) => {
  const on = usePreferences((s) => s.appLock);
  const setOn = usePreferences((s) => s.setAppLock);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    biometricName()
      .then(setName)
      .catch(() => setName(null));
  }, []);
  if (!name && !on) return null;
  const label = `Unlock with ${name ?? 'Face ID or fingerprint'}`;
  return (
    <Row first={first} minHeight={52}>
      <View style={{ flex: 1, gap: 1 }}>
        <T weight={500}>{label}</T>
        <T size={12.5} color="text3">
          Asked when you open the app on this phone
        </T>
      </View>
      <Toggle
        label={label}
        on={on}
        onChange={async (v) => {
          if (v && !(await confirmWithDevice('Turn on app lock'))) return;
          setOn(v);
        }}
      />
    </Row>
  );
};
