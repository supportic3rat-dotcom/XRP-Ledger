import type { KycStatus, Tone } from '@xrp/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { BalancedText } from '@/components/Balanced';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HeroIcon } from '@/components/Glyph';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Status } from '@/components/Status';
import { StepBar } from '@/components/Steps';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { useKycStatus } from '@/data/hooks';

const I_ID = 'M4 6.5h16v11H4zM8 10.5h3M8 13.5h5M15.5 10.5h1.5';
const I_OK = 'M12 3.5l7 2.6v5.4c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.1zM8.8 12.2l2.2 2.2 4.2-4.4';
const I_CLOCK = 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2';
const I_ALERT = 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.8v5M12 16.2h.01';
const I_X = 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9 9l6 6M15 9l-6 6';
const I_LOCK = 'M5 10.5h14v10H5zM8 10.5V8a4 4 0 0 1 8 0v2.5';

type StateCopy = {
  label: string;
  tone: Tone;
  icon: string;
  title: string;
  body: string;
  cta: string;
  target: 'identity' | 'home' | 'support';
  secondary: string;
  secondaryTarget: 'home' | 'custody';
};

const STATES: Record<KycStatus, StateCopy> = {
  not_started: {
    label: 'Not started',
    tone: 'off',
    icon: I_ID,
    title: 'Verify your identity',
    body: 'It takes about 5 minutes. You’ll need a government-issued photo ID and a well-lit place to take a selfie.',
    cta: 'Start verification',
    target: 'identity',
    secondary: 'Do this later',
    secondaryTarget: 'home',
  },
  in_progress: {
    label: 'In progress',
    tone: 'wait',
    icon: I_CLOCK,
    title: 'We’re reviewing your details',
    body: 'Most reviews finish within a few hours. We’ll notify you when there’s an update — you don’t need to keep the app open.',
    cta: 'Go to Home',
    target: 'home',
    secondary: 'Go to Home',
    secondaryTarget: 'home',
  },
  verified: {
    label: 'Verified',
    tone: 'ok',
    icon: I_OK,
    title: 'You’re verified',
    body: 'Your custodial account is set up and your XRP deposit address is ready.',
    cta: 'Go to Home',
    target: 'home',
    secondary: 'View custody account',
    secondaryTarget: 'custody',
  },
  more_info: {
    label: 'Additional information required',
    tone: 'wait',
    icon: I_ALERT,
    title: 'We need one more document',
    body: 'Your proof of address couldn’t be read. Upload a bank statement or utility bill from the last 3 months.',
    cta: 'Upload document',
    target: 'identity',
    secondary: 'Do this later',
    secondaryTarget: 'home',
  },
  rejected: {
    label: 'Rejected',
    tone: 'bad',
    icon: I_X,
    title: 'We couldn’t verify your identity',
    body: 'Your application didn’t meet our verification requirements. You can contact support to ask about next steps.',
    cta: 'Contact support',
    target: 'support',
    secondary: 'Go to Home',
    secondaryTarget: 'home',
  },
  restricted: {
    label: 'Restricted',
    tone: 'bad',
    icon: I_LOCK,
    title: 'Your account is restricted',
    body: 'Some services are paused on your account. You can still sign in and see your balances. Contact support for details.',
    cta: 'Contact support',
    target: 'support',
    secondary: 'Go to Home',
    secondaryTarget: 'home',
  },
};

const CHECKS: Partial<Record<KycStatus, [string, Tone][]>> = {
  not_started: [
    ['Not started', 'off'],
    ['Not started', 'off'],
    ['Not started', 'off'],
  ],
  in_progress: [
    ['Received', 'ok'],
    ['Received', 'ok'],
    ['In review', 'wait'],
  ],
  more_info: [
    ['Received', 'ok'],
    ['Received', 'ok'],
    ['Action needed', 'bad'],
  ],
};
const CHECK_ROWS: [string, string][] = [
  ['Photo ID', 'Passport, national ID or driver’s licence'],
  ['Selfie', 'Matched against your ID photo'],
  ['Proof of address', 'Dated within the last 3 months'],
];
const UNLOCKS = ['Deposits', 'Withdrawals', 'Exchange requests', 'Yield products', 'Borrowing'];

/** Verification status (six states). The status comes from the KYC provider; this screen only displays it. */
export const VerifyScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: KycStatus }>();
  const kyc = useKycStatus();
  const key: KycStatus = params.status && params.status in STATES ? params.status : (kyc.data ?? 'not_started');
  const st = STATES[key];
  const verified = key === 'verified';
  const blocked = key === 'rejected' || key === 'restricted';
  const checks = CHECKS[key];
  const go = (t: StateCopy['target'] | StateCopy['secondaryTarget']) =>
    t === 'identity' ? router.push('/identity') : t === 'support' ? router.push('/support') : t === 'custody' ? router.push('/custody') : router.replace('/');

  return (
    <Screen>
      <ScrollBody>
        <TopBar leading="back" label="Step 2 of 2 · Identity" />
        <StepBar total={2} current={2} allOn style={{ marginBottom: 28 }} />
        <View style={{ gap: 12 }}>
          <HeroIcon d={st.icon} tone={st.tone === 'off' ? 'off' : st.tone} size={56} iconSize={26} />
          <Status tone={st.tone} label={st.label} />
          <BalancedText size={24} weight={600} ls={-0.02} accessibilityRole="header">
            {st.title}
          </BalancedText>
          <T lh={1.5} color="text2">
            {st.body}
          </T>
        </View>
        {checks ? (
          <>
            <Sec>What we’ll check</Sec>
            <Card>
              {CHECK_ROWS.map(([label, hint], i) => (
                <Row key={label} first={i === 0} minHeight={52}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T weight={500}>{label}</T>
                    <T size={12.5} color="text3">
                      {hint}
                    </T>
                  </View>
                  <Status tone={checks[i]![1]} label={checks[i]![0]} />
                </Row>
              ))}
            </Card>
          </>
        ) : null}
        <Sec>What verification unlocks</Sec>
        <Card>
          {UNLOCKS.map((label, i) => {
            const extra = verified && (label === 'Yield products' || label === 'Borrowing');
            const status = verified ? (extra ? 'Separate agreement' : 'Available') : blocked ? 'Unavailable' : 'Needs verification';
            const tone: Tone = verified ? (extra ? 'off' : 'ok') : blocked ? 'bad' : 'off';
            return (
              <Row key={label} first={i === 0} minHeight={52}>
                <T weight={500} style={{ flex: 1 }}>
                  {label}
                </T>
                <Status tone={tone} label={status} />
              </Row>
            );
          })}
        </Card>
        <View style={{ gap: 10, marginTop: 24 }}>
          <Button as="a" label={st.cta} onPress={() => go(st.target)} />
          <Button as="a" label={st.secondary} variant="secondary" onPress={() => go(st.secondaryTarget)} />
        </View>
        <Banner tone="info" icon="info" style={{ marginTop: 20 }}>
          Your status comes from our verification provider, [KYC provider]. This screen only displays it and can’t change it.
        </Banner>
      </ScrollBody>
    </Screen>
  );
};
