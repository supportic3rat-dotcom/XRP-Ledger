import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Pill } from '@/components/Badge';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AreaChart, Sparkline } from '@/components/Charts';
import { PeriodChips, PillChips } from '@/components/Chips';
import { CopyButton } from '@/components/CopyButton';
import { CheckRow, ErrorText, Field, Help, Label, OtpInput, Radio, TextField } from '@/components/Form';
import { Glyph, HeroIcon } from '@/components/Glyph';
import { BrandMark, Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { KV } from '@/components/KV';
import { LtvMeter } from '@/components/LtvMeter';
import { Row } from '@/components/Row';
import { Sec } from '@/components/Sec';
import { Segmented } from '@/components/Segmented';
import { Status } from '@/components/Status';
import { StepBar } from '@/components/Steps';
import { T } from '@/components/T';
import { Timeline } from '@/components/Timeline';
import { Toggle } from '@/components/Toggle';
import { TopBar } from '@/components/TopBar';
import { sampleSeries, chartPeriods, sparkPath } from '@xrp/providers';
import { icons, type IconName } from '@xrp/tokens';
import { ThemeProvider, useTheme, type Scheme } from '@/theme';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <View>
    <Sec>{title}</Sec>
    <View style={{ gap: 10 }}>{children}</View>
  </View>
);

const values = sampleSeries(chartPeriods[2]!, 15279.84, chartPeriods[2]!.n * 13 + 7, 0.035);

/** Every component in every state, rendered in one theme. */
const Gallery = () => {
  const { c, scheme } = useTheme();
  const [seg, setSeg] = useState('a');
  const [chip, setChip] = useState<'1D' | '1W' | '1M'>('1M');
  const [check, setCheck] = useState(true);
  const [toggle, setToggle] = useState(true);
  const [otp, setOtp] = useState('123');
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 16, paddingBottom: 40 }}>
      <T size={24} weight={600} ls={-0.02} style={{ marginTop: 24 }}>{`Components · ${scheme}`}</T>
      <Section title="Type">
        <T size={30} weight={600} lh={1.15} ls={-0.025}>
          Display 30/600
        </T>
        <T size={17} weight={600}>
          Screen title 17/600
        </T>
        <T size={13} weight={600} color="text2">
          Section label 13/600 text-2
        </T>
        <T>Body 14/400 · 1.4</T>
        <T size={12.5} color="text3">
          Hint 12.5 text-3
        </T>
        <T size={36} weight={500} ls={-0.03} num>
          $15,279.84
        </T>
        <T mono>rP9prototype0not0a0real0address · 48201937</T>
      </Section>
      <Section title="Buttons">
        <Button as="a" label="Primary (link) 15/500" />
        <Button label="Primary (button) 14/400" />
        <Button as="a" label="Secondary" variant="secondary" />
        <Button label="Loading" loading />
        <Button label="Disabled" disabled />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Height 48" size={48} flex={1} />
          <Button label="Danger" variant="secondary" textColor="neg" flex={1} as="a" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Small 40" size={40} variant="secondary" flex={1} />
          <Button label="Small 36" size={36} variant="secondary" />
          <CopyButton label="Copy address" onPress={() => undefined} icon={<Icon name="copy" size="sm" />} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="back" label="Back" />
          <IconButton icon="close" label="Close" />
          <IconButton icon="bell" label="Notifications" dot />
          <BrandMark size={32} />
        </View>
      </Section>
      <Section title="Top bar">
        <Card>
          <View style={{ paddingHorizontal: 16 }}>
            <TopBar title="Screen title" trailing={<IconButton icon="markets" label="Markets" />} />
            <TopBar label="Step 1 of 3 · Account" />
          </View>
        </Card>
      </Section>
      <Section title="Status, badges, pills">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <Status tone="ok" label="Credited" />
          <Status tone="wait" label="Validating" />
          <Status tone="bad" label="Rejected" />
          <Status tone="off" label="Not started" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Badge label="Active" tone="ok" />
          <Badge label="Indicative · not a quote" tone="warn" />
          <Badge label="Rejected" tone="bad" />
          <Badge label="Not available" />
          <Badge label="Planned" tone="muted" />
          <Badge label="Completed" tone="okPos" size="lg" />
          <Badge label="Price only" tone="muted" size="sm" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill>
            <Icon name="shield" size="xs" color="accentText" />
            <T size={12} weight={500} color="accentText">
              Custodial account
            </T>
          </Pill>
          <Pill height={26}>
            <Icon name="check" size="sm" color="accentText" />
            <T size={12} weight={500} color="accentText">
              Verified
            </T>
          </Pill>
        </View>
      </Section>
      <Section title="Banners">
        <Banner tone="info" icon="info">
          Info banner with an icon and one or two sentences.
        </Banner>
        <Banner tone="warn" icon="alert">
          Warning: always include your destination tag.
        </Banner>
        <Banner tone="error" icon="alert">
          Error: that email and password don’t match.
        </Banner>
      </Section>
      <Section title="Inputs">
        <Field>
          <Label>Default</Label>
          <TextField placeholder="you@example.com" />
        </Field>
        <Field>
          <Label>Invalid</Label>
          <TextField value="not-an-address" invalid />
          <ErrorText>Enter a valid XRP Ledger address.</ErrorText>
        </Field>
        <Field>
          <Label>Amount</Label>
          <TextField height={64} size={26} weight={500} num value="1,250.00" trailing={<T weight={500} color="text2">XRP</T>} />
          <Help>Available 4,170.10 XRP</Help>
        </Field>
        <OtpInput label="Code" value={otp} onChange={setOtp} />
        <CheckRow checked={check} onChange={setCheck}>
          Checkbox with a label that wraps onto a second line when it is long enough.
        </CheckRow>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Radio on />
          <Radio on={false} />
          <Toggle label="Toggle" on={toggle} onChange={setToggle} />
          <Toggle label="Toggle off" on={false} onChange={() => undefined} />
        </View>
      </Section>
      <Section title="Segmented, chips">
        <Segmented
          label="Segmented"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'a', label: 'All' },
            { value: 'b', label: 'Activity' },
            { value: 'c', label: 'Security' },
          ]}
        />
        <PeriodChips label="Period" options={['1D', '1W', '1M'] as const} value={chip} onChange={setChip} />
        <PillChips variant="earn" chips={[{ label: '10 days', onPress: () => undefined }, { label: '90 days', on: true, onPress: () => undefined }]} />
        <PillChips variant="loan" chips={[{ label: 'Interest $4.93', onPress: () => undefined }, { label: '+250', onPress: () => undefined }]} />
      </Section>
      <Section title="Rows, key-values">
        <Card>
          <Row first chevron onPress={() => undefined}>
            <T weight={500} style={{ flex: 1 }}>
              Link row
            </T>
          </Row>
          <Row>
            <T weight={500} style={{ flex: 1 }}>
              Static row
            </T>
            <Status tone="ok" label="Active" />
          </Row>
        </Card>
        <Card>
          <KV
            num
            items={[
              { k: 'Network fee', v: '≈ 0.000012 XRP' },
              { k: 'Platform fee', v: '0.25 XRP' },
              { k: 'Recipient receives', v: '299.749988 XRP', total: true },
            ]}
          />
        </Card>
      </Section>
      <Section title="Timeline, steps, meter">
        <Card>
          <Timeline
            steps={[
              { label: 'Submitted', note: 'Request recorded', state: 'done' },
              { label: 'In review', note: 'Checks running', state: 'now' },
              { label: 'Completed', note: 'After ledger validation', state: '' },
            ]}
          />
        </Card>
        <StepBar total={4} current={2} />
        <LtvMeter ltvPct={33.9} color={c.accent} ariaLabel="Loan-to-value 33.9 percent" />
      </Section>
      <Section title="Charts, glyphs, hero icons">
        <Card style={{ padding: 16 }}>
          <AreaChart values={values} height={112} ariaLabel="Sample chart" />
        </Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Sparkline path={sparkPath(3, 310)} color={c.pos} />
          <Sparkline path={sparkPath(9, -85)} color={c.neg} />
          <Glyph char="X" />
          <Glyph char="₿" muted mutedColor="text2" />
          <HeroIcon icon="lock" />
          <HeroIcon icon="clock" tone="wait" size={56} iconSize={26} />
        </View>
      </Section>
      <Section title="Icons">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {(Object.keys(icons) as IconName[]).map((n) => (
            <View key={n} accessibilityLabel={n}>
              <Icon name={n} />
            </View>
          ))}
        </View>
      </Section>
    </View>
  );
};

/** Component gallery: the full library in dark, then light. Development route `/gallery`. */
export const GalleryScreen = () => {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top }}>
      {(['dark', 'light'] as Scheme[]).map((s) => (
        <ThemeProvider key={s} force={s}>
          <Gallery />
        </ThemeProvider>
      ))}
    </ScrollView>
  );
};
