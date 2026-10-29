import { useQueryClient } from '@tanstack/react-query';
import { COUNTRIES as ALL_COUNTRIES } from '@xrp/ledger';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow, ErrorText, Help, Label, Radio } from '@/components/Form';
import { HeroIcon } from '@/components/Glyph';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Footer } from '@/components/Footer';
import { Screen, ScrollBody } from '@/components/Screen';
import { Select } from '@/components/Select';
import { StepBar } from '@/components/Steps';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useTheme } from '@/theme';

type DocId = 'passport' | 'national' | 'licence';
type StepId = 'doc' | 'front' | 'back' | 'selfie' | 'address' | 'review' | 'done';
const DOCS: { id: DocId; label: string; hint: string; sides: 1 | 2 }[] = [
  { id: 'passport', label: 'Passport', hint: 'Photo page only', sides: 1 },
  { id: 'national', label: 'National ID card', hint: 'Front and back', sides: 2 },
  { id: 'licence', label: 'Driver’s licence', hint: 'Front and back', sides: 2 },
];
/** Issuing countries: the United States first, then every country A to Z. */
const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  ...ALL_COUNTRIES.filter((x) => x.code !== 'US').map((x) => ({ value: x.code, label: x.name })),
];

/** The face scan: three poses, so Compliance sees a live person turning, not a held-up photo. */
const POSES = [
  { key: 'selfie', prompt: 'Look straight at the camera', done: 'Straight' },
  { key: 'left', prompt: 'Turn your head slightly to the left', done: 'Left' },
  { key: 'right', prompt: 'Now turn slightly to the right', done: 'Right' },
] as const;

const H1 = ({ children }: { children: string }) => (
  <T size={22} weight={600} ls={-0.02} style={{ marginBottom: 6 }} accessibilityRole="header">
    {children}
  </T>
);
const Lead = ({ children }: { children: string }) => (
  <T lh={1.5} color="text2" style={{ marginBottom: 18 }}>
    {children}
  </T>
);

/** `.frame` corner guides: 26px L-shapes, 3px in text colour, 14px inset. */
const Corners = () => {
  const { c } = useTheme();
  const base = { position: 'absolute' as const, width: 26, height: 26, borderColor: c.text };
  return (
    <>
      <View style={[base, { top: 14, left: 14, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 }]} />
      <View style={[base, { top: 14, right: 14, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 }]} />
      <View style={[base, { bottom: 14, left: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 }]} />
      <View style={[base, { bottom: 14, right: 14, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 }]} />
    </>
  );
};

export const IdentityCaptureScreen = () => {
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<ComponentRef<typeof CameraView>>(null);
  const [i, setI] = useState(0);
  const [doc, setDoc] = useState<DocId>('national');
  const [country, setCountry] = useState('US');
  const [shots, setShots] = useState<{ front?: string; back?: string; selfie?: string; left?: string; right?: string }>({});
  const [addrDoc, setAddrDoc] = useState<'bank' | 'utility'>('bank');
  const [file, setFile] = useState<{ name: string; size: number; type: string; uri: string } | null>(null);
  const [fileTried, setFileTried] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentTried, setConsentTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  const d = DOCS.find((x) => x.id === doc) ?? DOCS[1]!;
  const steps: StepId[] = ['doc', 'front', ...(d.sides === 2 ? (['back'] as const) : []), 'selfie', 'address', 'review', 'done'];
  const cur = steps[i] ?? 'doc';
  const total = steps.length - 1;
  const isPhoto = cur === 'front' || cur === 'back';
  const captureStep = isPhoto || cur === 'selfie';
  const pose = POSES.findIndex((x) => !shots[x.key]);
  const faceDone = pose === -1;
  const taken = cur === 'front' ? !!shots.front : cur === 'back' ? !!shots.back : cur === 'selfie' ? faceDone : false;
  const go = (n: number) => setI(Math.max(0, Math.min(steps.length - 1, n)));
  const useLiveCamera = Platform.OS !== 'web' && !!permission?.granted;

  const capture = async () => {
    setError('');
    if (Platform.OS !== 'web' && !permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setError('Camera access is needed to photograph your ID. You can allow it in Settings.');
        return;
      }
    }
    let uri = 'captured';
    if (useLiveCamera && camera.current) {
      // Kept in the app's cache only (never the camera roll) and uploaded straight to the private kyc bucket.
      const photo = await camera.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
      uri = photo?.uri ?? uri;
    }
    const key = cur === 'selfie' ? POSES[pose === -1 ? 0 : pose]!.key : cur === 'back' ? 'back' : 'front';
    setShots((s) => ({ ...s, [key]: uri }));
  };
  const retake = () =>
    setShots((s) => (cur === 'selfie' ? { ...s, selfie: undefined, left: undefined, right: undefined } : { ...s, [cur === 'back' ? 'back' : 'front']: undefined }));

  const chooseFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
    const asset = r.assets?.[0];
    if (r.canceled || !asset) return;
    if ((asset.size ?? 0) > 10 * 1024 * 1024) {
      setError('That file is over 10 MB. Choose a smaller PDF, JPG or PNG.');
      return;
    }
    setError('');
    setFile({ name: asset.name, size: asset.size ?? 0, type: asset.mimeType ?? 'application/pdf', uri: asset.uri });
  };

  const next = async () => {
    if (cur === 'address' && !file) {
      setFileTried(true);
      return;
    }
    if (cur === 'review') {
      if (!consent) {
        setConsentTried(true);
        return;
      }
      setBusy(true);
      try {
        // Face ID / fingerprint: the phone's owner confirms it's them submitting.
        if (Platform.OS !== 'web' && (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE) {
          const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm it’s you to submit your ID', disableDeviceFallback: false });
          if (!auth.success) throw new Error('Confirm it’s you with Face ID, fingerprint or your passcode to submit.');
        }
        const jpg = (uri?: string) => ({ uri: uri ?? '', type: 'image/jpeg' });
        const r = await api.submitKyc({
          documentType: doc,
          country,
          addressDocument: addrDoc,
          files: {
            [d.id === 'passport' ? 'id-photo' : 'id-front']: jpg(shots.front),
            ...(d.sides === 2 ? { 'id-back': jpg(shots.back) } : {}),
            selfie: jpg(shots.selfie),
            'face-left': jpg(shots.left),
            'face-right': jpg(shots.right),
            ...(file ? { [`address-${addrDoc}`]: { uri: file.uri, type: file.type } } : {}),
          },
        });
        setReference(r.reference);
        await qc.invalidateQueries();
        go(i + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'We couldn’t submit your documents. Try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    go(i + 1);
  };

  const fmtSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
  const fileKind = (t: string) => (t.includes('pdf') ? 'PDF' : t.includes('png') ? 'PNG' : 'JPG');

  return (
    <Screen>
      <ScrollBody bottom={108}>
        <TopBar
          leading={i > 0 && cur !== 'done' ? 'back' : 'close'}
          label={cur === 'done' ? 'Identity' : `Step ${i + 1} of ${total} · Identity`}
          onLeading={i > 0 && cur !== 'done' ? () => go(i - 1) : () => router.replace('/verify')}
          marginBottom={4}
        />
        {cur !== 'done' ? <StepBar total={total} current={i + 1} style={{ marginBottom: 20 }} /> : null}
        {error ? (
          <Banner tone="error" icon="alert" alert style={{ marginBottom: 14 }}>
            {error}
          </Banner>
        ) : null}

        {cur === 'doc' ? (
          <>
            <H1>Choose your ID</H1>
            <Lead>Use a valid, unexpired government-issued photo ID.</Lead>
            <Card>
              <View accessibilityRole="radiogroup" accessibilityLabel="Document type">
                {DOCS.map((x, k) => (
                  <Row
                    key={x.id}
                    first={k === 0}
                    minHeight={60}
                    accessibilityState={{ checked: x.id === doc }}
                    onPress={() => {
                      setDoc(x.id);
                      setShots({});
                    }}
                  >
                    <View style={{ flex: 1, gap: 1 }}>
                      <T weight={500}>{x.label}</T>
                      <Help>{x.hint}</Help>
                    </View>
                    <Radio on={x.id === doc} />
                  </Row>
                ))}
              </View>
            </Card>
            <View style={{ gap: 6, marginTop: 18 }}>
              <Label>Issuing country</Label>
              <Select label="Issuing country" value={country} onChange={setCountry} options={COUNTRY_OPTIONS} />
            </View>
            <Banner tone="info" icon="shield" style={{ marginTop: 18 }}>
              Photos are uploaded over an encrypted connection to private storage that only our compliance team can open. They aren’t saved to your camera roll.
            </Banner>
          </>
        ) : null}

        {isPhoto ? (
          <>
            <H1>
              {cur === 'back'
                ? `Back of your ${d.label.toLowerCase()}`
                : d.id === 'passport'
                  ? 'Passport photo page'
                  : `Front of your ${d.label.toLowerCase()}`}
            </H1>
            <Lead>
              {cur === 'back'
                ? 'Turn it over and fit the back inside the frame.'
                : 'Fit the document inside the frame, then take the photo.'}
            </Lead>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={taken ? 'Document photo captured' : 'Camera preview with document guide'}
              style={{
                height: 220,
                borderRadius: 14,
                backgroundColor: taken ? c.accentSoft : c.sunken,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                overflow: 'hidden',
              }}
            >
              {useLiveCamera && !taken ? <CameraView ref={camera} facing="back" style={{ position: 'absolute', inset: 0 }} /> : null}
              <Corners />
              {taken ? (
                <>
                  <Icon name="check" size={32} color="pos" />
                  <T weight={500}>Photo captured</T>
                </>
              ) : !useLiveCamera ? (
                <>
                  <Icon name="camera" size={32} color="text3" />
                  <T size={13} color="text3">
                    Camera preview
                  </T>
                </>
              ) : null}
            </View>
            {taken ? (
              <View style={{ gap: 8, marginTop: 14 }}>
                {['All four corners visible', 'Text is readable, no glare'].map((t) => (
                  <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="check" size="sm" color="pos" />
                    <T size={13} color="text2">
                      {t}
                    </T>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ marginTop: 14, gap: 0 }}>
                {['Place the document on a dark, flat surface', 'Fit it inside the corners', 'Avoid glare and shadows'].map((t) => (
                  <View key={t} style={{ flexDirection: 'row' }}>
                    <T size={13} lh={1.6} color="text2" style={{ width: 18 }}>
                      •
                    </T>
                    <T size={13} lh={1.6} color="text2" style={{ flex: 1 }}>
                      {t}
                    </T>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}

        {cur === 'selfie' ? (
          <>
            <H1>Face scan</H1>
            <Lead>We compare your face with the photo on your ID. Keep your face inside the oval and follow each prompt.</Lead>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={faceDone ? 'Face scan complete' : `Camera preview. ${POSES[pose]!.prompt}`}
                style={{ width: 190, height: 240, alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', borderRadius: 95 }}
              >
                {useLiveCamera && !faceDone ? <CameraView ref={camera} facing="front" style={{ position: 'absolute', inset: 0 }} /> : null}
                <Svg width={190} height={240} style={{ position: 'absolute' }}>
                  <Ellipse
                    cx={95}
                    cy={120}
                    rx={93.5}
                    ry={118.5}
                    fill="none"
                    stroke={faceDone ? c.pos : c.accent}
                    strokeWidth={3}
                    strokeDasharray={faceDone ? undefined : '9 6'}
                  />
                </Svg>
                {faceDone ? (
                  <>
                    <Icon name="check" size={32} color="pos" />
                    <T weight={500}>Face scan complete</T>
                  </>
                ) : !useLiveCamera ? (
                  <>
                    <Icon name="face" size={32} color="text3" />
                    <T size={13} color="text3">
                      Face in the oval
                    </T>
                  </>
                ) : null}
              </View>
            </View>
            <T size={16} weight={600} align="center" style={{ marginTop: 12 }} accessibilityLiveRegion="polite">
              {faceDone ? 'All three angles captured' : POSES[pose]!.prompt}
            </T>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
              {POSES.map((x) => (
                <View key={x.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={shots[x.key] ? 'checkCircle' : 'clock'} size="sm" color={shots[x.key] ? 'pos' : 'text3'} />
                  <T size={12.5} color={shots[x.key] ? 'text' : 'text3'}>
                    {x.done}
                  </T>
                </View>
              ))}
            </View>
            <Help align="center" style={{ marginTop: 12 }}>
              {faceDone ? 'Looks good. Continue when you’re ready.' : 'Remove glasses and hats, and make sure your face is well lit.'}
            </Help>
          </>
        ) : null}

        {cur === 'address' ? (
          <>
            <H1>Proof of address</H1>
            <Lead>A bank statement or utility bill showing your name and address, dated within the last 3 months.</Lead>
            <Card>
              <View accessibilityRole="radiogroup" accessibilityLabel="Proof of address type">
                {(
                  [
                    ['bank', 'Bank statement'],
                    ['utility', 'Utility bill'],
                  ] as const
                ).map(([id, label], k) => (
                  <Row key={id} first={k === 0} minHeight={60} accessibilityState={{ checked: addrDoc === id }} onPress={() => setAddrDoc(id)}>
                    <T weight={500} style={{ flex: 1 }}>
                      {label}
                    </T>
                    <Radio on={addrDoc === id} />
                  </Row>
                ))}
              </View>
            </Card>
            <View style={{ marginTop: 14 }}>
              {file ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: c.borderStrong,
                    borderRadius: 12,
                  }}
                >
                  <Icon name="file" />
                  <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                    <T weight={500} numberOfLines={1}>
                      {file.name}
                    </T>
                    <Help>{`${fmtSize(file.size)} · ${fileKind(file.type)}`}</Help>
                  </View>
                  <IconButton icon="close" size="sm" label="Remove file" onPress={() => setFile(null)} />
                </View>
              ) : (
                <>
                  <Button label="Choose file or take photo" variant="secondary" icon={<Icon name="upload" size="sm" />} onPress={chooseFile} />
                  <Help style={{ marginTop: 8, marginHorizontal: 4 }}>PDF, JPG or PNG up to 10 MB.</Help>
                </>
              )}
              {fileTried && !file ? <ErrorText style={{ marginTop: 8, marginHorizontal: 4 }}>Add a document to continue.</ErrorText> : null}
            </View>
          </>
        ) : null}

        {cur === 'review' ? (
          <>
            <H1>Check and submit</H1>
            <Lead>You can’t edit these after submitting, but you can start again if something’s wrong.</Lead>
            <Card>
              <KV
                items={[
                  { k: 'ID document', v: d.label },
                  { k: 'Issuing country', v: COUNTRY_OPTIONS.find((x) => x.value === country)?.label ?? '' },
                  { k: 'Photos', v: d.sides === 2 ? 'Front and back' : 'Photo page' },
                  { k: 'Face scan', v: 'Straight, left and right' },
                  { k: 'Proof of address', v: addrDoc === 'bank' ? 'Bank statement' : 'Utility bill' },
                ]}
              />
            </Card>
            <CheckRow checked={consent} onChange={setConsent} style={{ marginTop: 18 }}>
              <T size={13.5} lh={1.45}>
                I agree that the compliance team may review my ID and face scan to verify my identity, as described in the{' '}
                <T size={13.5} lh={1.45} color="accentText" accessibilityRole="link" onPress={() => router.push('/legal')}>
                  Privacy Policy
                </T>
                .
              </T>
            </CheckRow>
            {consentTried && !consent ? (
              <ErrorText style={{ marginTop: 8, marginLeft: 30 }}>You need to agree before we can verify your identity.</ErrorText>
            ) : null}
          </>
        ) : null}

        {cur === 'done' ? (
          <>
            <View style={{ gap: 10, paddingTop: 40 }}>
              <HeroIcon icon="clock" tone="wait" size={56} iconSize={26} />
              <T size={22} weight={600} ls={-0.02} accessibilityRole="header">
                Submitted for review
              </T>
              <T lh={1.5} color="text2">
                Most reviews finish within a few hours. We’ll notify you when your status changes — you don’t need to keep the app open.
              </T>
            </View>
            <Card style={{ marginTop: 20 }}>
              <KV
                items={[
                  { k: 'Reference', v: reference, mono: true, valueSize: 12.5 },
                  { k: 'Status', v: 'In review' },
                  { k: 'Meanwhile you can', v: 'Explore the app' },
                ]}
              />
            </Card>
          </>
        ) : null}
      </ScrollBody>

      <Footer>
        {captureStep && !taken ? <Button label={cur === 'selfie' ? (pose === 0 ? 'Start face scan' : 'Capture') : 'Take photo'} onPress={capture} flex={1} /> : null}
        {captureStep && taken ? (
          <>
            <Button label="Retake" variant="secondary" onPress={retake} flex={1} />
            <Button label="Use photo" onPress={next} flex={1} />
          </>
        ) : null}
        {!captureStep && cur !== 'done' ? <Button label={cur === 'review' ? 'Submit for review' : 'Continue'} onPress={next} loading={busy} flex={1} /> : null}
        {cur === 'done' ? (
          <>
            <Button as="a" label="View status" variant="secondary" onPress={() => router.replace('/verify')} flex={1} />
            <Button as="a" label="Go to Home" onPress={() => router.replace('/')} flex={1} />
          </>
        ) : null}
      </Footer>
    </Screen>
  );
};
