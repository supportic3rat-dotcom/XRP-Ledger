import type { Consent, LegalDocumentId, Tone } from '@xrp/types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckRow, ErrorText } from '@/components/Form';
import { Footer } from '@/components/Footer';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import type { LegalDoc } from '@/data/api';
import { useApiMutation, useConsents, useLegalDocuments } from '@/data/hooks';
import { useSession } from '@/state/session';
import { mdy, mdyhm } from '@/lib/dates';

const GROUPS = ['Account', 'Custody & payments', 'Products'] as const;

const statusOf = (doc: LegalDoc, consent: Consent | undefined, signedIn = true): { label: string; tone: Tone; pending: boolean } => {
  if (!signedIn) return { label: 'For reference', tone: 'off', pending: false };
  if (consent && consent.version !== doc.version) return { label: 'Review update', tone: 'wait', pending: true };
  if (!consent && !doc.requiresAcceptance) return { label: 'For reference', tone: 'off', pending: false };
  if (!consent) return { label: 'Review update', tone: 'wait', pending: true };
  return { label: 'Accepted', tone: 'ok', pending: false };
};

export const LegalScreen = () => {
  const router = useRouter();
  const docs = useLegalDocuments();
  const signedIn = useSession((s) => s.signedIn);
  const consents = useConsents(signedIn);
  const accept = useApiMutation(({ id, version }: { id: LegalDocumentId; version: string }) => api.acceptConsent(id, version));
  const [open, setOpen] = useState<LegalDocumentId | null>(null);
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);
  const [justAccepted, setJustAccepted] = useState<LegalDocumentId | null>(null);

  const consentFor = (id: LegalDocumentId) => consents.data?.find((c) => c.document === id);
  const all = docs.data ?? [];
  const anyPending = all.some((d) => statusOf(d, consentFor(d.id), signedIn).pending);
  const doc = all.find((d) => d.id === open);
  const consent = doc ? consentFor(doc.id) : undefined;
  const st = doc ? statusOf(doc, consent, signedIn) : null;

  const doAccept = async () => {
    if (!doc) return;
    if (!agree) {
      setTried(true);
      return;
    }
    await accept.mutateAsync({ id: doc.id, version: doc.version });
    setJustAccepted(doc.id);
    setTried(false);
  };

  return (
    <Screen>
      <ScrollBody bottom={st?.pending ? 108 : 32}>
        <TopBar
          title={doc ? doc.name : 'Legal & disclosures'}
          leadingLabel={doc ? 'Back to documents' : 'Back to Profile'}
          onLeading={doc ? () => setOpen(null) : () => (router.canGoBack() ? router.back() : router.replace(signedIn ? '/profile' : '/welcome'))}
        />
        {!doc ? (
          <>
            {anyPending ? (
              <Banner tone="warn" icon="alert">
                One document has changed and needs your review.
              </Banner>
            ) : null}
            {GROUPS.map((g) => (
              <View key={g}>
                <Sec top={20}>{g}</Sec>
                <Card>
                  {all
                    .filter((d) => d.group === g)
                    .map((d, i) => {
                      const s = statusOf(d, consentFor(d.id), signedIn);
                      return (
                        <Row
                          key={d.id}
                          first={i === 0}
                          minHeight={60}
                          chevron
                          accessibilityLabel={`${d.name}, version ${d.version}, ${s.label}`}
                          onPress={() => {
                            setOpen(d.id);
                            setAgree(false);
                            setTried(false);
                          }}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <T weight={500}>{d.name}</T>
                            <T size={12} color="text3">{`Version ${d.version}`}</T>
                          </View>
                          <Status tone={s.tone} label={s.label} base="text" />
                        </Row>
                      );
                    })}
                </Card>
              </View>
            ))}
          </>
        ) : (
          <>
            <View style={{ gap: 4, marginBottom: 14 }}>
              <T size={13} color="text3">{`Version ${doc.version}`}</T>
              {st ? <Status tone={st.tone} label={st.label} base="text" /> : null}
            </View>
            {st?.pending && doc.changeSummary ? (
              <Banner tone="warn" style={{ marginTop: 10 }}>
                <T size={13} lh={1.45} color="warn">
                  <T size={13} lh={1.45} weight={600} color="warn">{`What changed in ${doc.version}:`}</T> {doc.changeSummary}
                </T>
              </Banner>
            ) : null}
            <View>
              {doc.sections.map(([h, p]) => (
                <View key={h}>
                  <T size={15} weight={600} style={{ marginTop: 18, marginBottom: 6 }} accessibilityRole="header">
                    {h}
                  </T>
                  <T size={13.5} lh={1.6} color="text2">
                    {p}
                  </T>
                </View>
              ))}
            </View>
            {signedIn ? (
              <>
                <T size={13} weight={600} color="text2" style={{ marginTop: 22, marginHorizontal: 4, marginBottom: 8 }}>
                  Your acceptance record
                </T>
                <Card>
                  <KV
                    fixedKeys
                    items={[
                      { k: 'Version', v: consent ? consent.version : 'Not required' },
                      {
                        k: 'Accepted',
                        v: consent
                          ? justAccepted === doc.id
                            ? 'Just now'
                            : st?.pending
                              ? `${consent.version} on ${mdy(consent.acceptedAt)}`
                              : mdyhm(consent.acceptedAt)
                          : '—',
                      },
                      { k: 'Where', v: consent?.surface ?? '—' },
                      { k: 'Consent ID', v: consent?.consentId ?? '—', mono: true, valueSize: 12 },
                    ]}
                  />
                </Card>
              </>
            ) : null}
            {st?.pending ? (
              <>
                <CheckRow checked={agree} onChange={setAgree} style={{ marginTop: 16 }}>
                  {`I’ve read the updated ${doc.name} (${doc.version}).`}
                </CheckRow>
                {tried && !agree ? <ErrorText style={{ marginTop: 6, marginLeft: 30 }}>Tick the box to confirm you’ve read it.</ErrorText> : null}
              </>
            ) : null}
          </>
        )}
      </ScrollBody>
      {doc && st?.pending ? (
        <Footer>
          <Button label={`Accept ${doc.version}`} flex={1} loading={accept.isPending} onPress={doAccept} />
        </Footer>
      ) : null}
    </Screen>
  );
};
