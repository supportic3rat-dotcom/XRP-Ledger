import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Grab, Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { api } from '@/data';
import { mdy } from '@/lib/dates';
import { useTheme } from '@/theme';

/** How long a trust stays fixed after it's created. */
export const TRUST_LOCK_MONTHS = 6;

/** When the trust opens to changes: six calendar months after it was created. */
export const trustUnlocksAt = (createdAt: string): Date => {
  const d = new Date(createdAt);
  d.setMonth(d.getMonth() + TRUST_LOCK_MONTHS);
  return d;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Days, hours, minutes and seconds left until `until` (all zero once it has passed). */
const remaining = (until: Date, now: Date) => {
  const s = Math.max(0, Math.floor((until.getTime() - now.getTime()) / 1000));
  return { done: s === 0, days: Math.floor(s / 86_400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60 };
};

const Unit = ({ value, label }: { value: string; label: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: c.sunken, gap: 2 }}>
      <T size={24} weight={600} num>
        {value}
      </T>
      <T size={12} color="text3">
        {label}
      </T>
    </View>
  );
};

/** Live countdown to the end of the trust's six-month lock, ticking every second while open. */
export const TrustLockSheet = ({ open, onClose, createdAt }: { open: boolean; onClose: () => void; createdAt: string }) => {
  const [now, setNow] = useState(() => api.now());
  useEffect(() => {
    if (!open) return;
    setNow(api.now());
    const id = setInterval(() => setNow(api.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const until = trustUnlocksAt(createdAt);
  const left = remaining(until, now);

  return (
    <Sheet open={open} onClose={onClose} scrim="green" maxHeight={null} paddingX={20} accessibilityLabel="Time until changes can be made">
      <Grab bottom={16} />
      <T size={18} weight={600} style={{ marginBottom: 10 }} accessibilityRole="header">
        {left.done ? 'Your trust can now be changed' : 'Changes unlock in'}
      </T>
      {left.done ? (
        <T size={13.5} lh={1.5} color="text2" style={{ marginBottom: 16 }}>
          {`The ${TRUST_LOCK_MONTHS}-month period ended on ${mdy(until.toISOString())}. Email support.xrpledger@gmail.com to update your trust.`}
        </T>
      ) : (
        <>
          <View
            accessible
            accessibilityLabel={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes and ${left.seconds} seconds`}
            style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}
          >
            <Unit value={String(left.days)} label={left.days === 1 ? 'day' : 'days'} />
            <Unit value={pad(left.hours)} label="hours" />
            <Unit value={pad(left.minutes)} label="min" />
            <Unit value={pad(left.seconds)} label="sec" />
          </View>
          <T size={13.5} lh={1.5} color="text2" style={{ marginBottom: 16 }}>
            {`Your trust is set for ${TRUST_LOCK_MONTHS} months from the day you created it, ${mdy(createdAt)}. You can make changes from ${mdy(until.toISOString())}.`}
          </T>
        </>
      )}
      <Button label="Done" variant="secondary" onPress={onClose} />
    </Sheet>
  );
};
