import type { SupportTicket } from '@xrp/types';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorText, Field, Help, InputWrap, Label, TextField } from '@/components/Form';
import { Footer } from '@/components/Footer';
import { Icon } from '@/components/Icon';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Select } from '@/components/Select';
import { Grab, Sheet } from '@/components/Sheet';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { TopBar } from '@/components/TopBar';
import { api } from '@/data';
import { useActivity, useApiMutation, useTickets } from '@/data/hooks';
import { md } from '@/lib/dates';
import { familyFor, useTheme } from '@/theme';
import { useSession } from '@/state/session';
import { EMAIL } from '@xrp/schemas';

const TOPICS = [
  {
    id: 'tag',
    title: 'Why do XRP deposits need a destination tag?',
    body: 'Your deposit address is shared, so the tag tells us which account the XRP belongs to. Without it, the deposit is held aside until we can match it, which needs proof from you and can take a few business days.',
  },
  {
    id: 'pending',
    title: 'My deposit is still pending',
    body: 'Deposits are credited after the XRP Ledger validates the transaction and our screening checks pass. XRP usually validates within seconds; screening can add a short delay. You’ll get a notification when it’s credited.',
  },
  {
    id: 'wd',
    title: 'How long do withdrawals take?',
    body: 'Every withdrawal is reviewed before it’s sent. Most are approved within an hour during business hours; withdrawals over 1,000 XRP need a second reviewer. Once sent, they’re final after ledger validation.',
  },
  {
    id: 'net',
    title: 'Choosing the right network',
    body: 'Each asset here can only be sent and received on its own network. Sending an asset on a network the recipient doesn’t support can make the funds unrecoverable, so confirm the network with the recipient before you withdraw.',
  },
  {
    id: 'recover',
    title: 'I can’t sign in to my account',
    body: 'Contact us from this screen if you’re still signed in, or from the sign-in screen if not. We’ll verify your identity again before restoring access, and withdrawals pause for a short period afterwards.',
  },
  {
    id: 'secure',
    title: 'Keeping your account secure',
    body: 'Use a long password you don’t use anywhere else, and consider turning on the withdrawal allowlist. We will never ask for your password or a recovery phrase, by email, chat or phone.',
  },
  {
    id: 'fees',
    title: 'What fees do I pay?',
    body: 'Deposits are free. Withdrawals cost 0.25 XRP plus the network fee. Exchange requests show their spread and payout fee before you accept a quote. See Legal › Fees and Charges for the full list.',
  },
];
const TOPIC_OPTIONS = ['Deposit', 'Withdrawal', 'Exchange', 'Earn', 'Borrow', 'Account & security', 'Other'];
const STATUS: Record<SupportTicket['status'], [string, 'wait' | 'ok']> = {
  open: ['Open', 'wait'],
  waiting_on_us: ['Waiting on us', 'wait'],
  waiting_on_you: ['Waiting on you', 'wait'],
  resolved: ['Resolved', 'ok'],
};

const Chevron = ({ open }: { open: boolean }) => {
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 150 }) }] }));
  return (
    <Animated.View style={style}>
      <Icon name="chevronDown" size="sm" color="text3" />
    </Animated.View>
  );
};

export const SupportScreen = () => {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ tx?: string }>();
  const signedIn = useSession((s) => s.signedIn);
  const tickets = useTickets(signedIn);
  const activity = useActivity();
  const create = useApiMutation(api.createTicket);
  const [q, setQ] = useState('');
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [f, setF] = useState({ topic: '', tx: '', msg: '', email: '', tried: false });
  const [error, setError] = useState('');

  useEffect(() => {
    if (openTicket === null && tickets.data?.[0]) setOpenTicket(tickets.data[0].ref);
  }, [tickets.data, openTicket]);
  useEffect(() => {
    if (params.tx) {
      setF({ topic: '', tx: params.tx, msg: '', email: '', tried: false });
      setSheet(true);
    }
  }, [params.tx]);

  const query = q.trim().toLowerCase();
  const topics = TOPICS.filter((t) => !query || `${t.title} ${t.body}`.toLowerCase().includes(query));
  const msgOk = f.msg.trim().length >= 20;
  const txOptions = [
    { value: '', label: 'None' },
    ...activity.views
      .slice(0, 6)
      .map((t) => ({ value: t.ref, label: `${t.title.replace(/ · XRP$/, '')} · ${t.amount.replace(/^[+−]/, '')} · ${t.date.replace(/, \d\d:\d\d$/, '')}` })),
  ];

  const submit = async () => {
    if (!f.topic || !msgOk || (!signedIn && !EMAIL.test(f.email.trim()))) {
      setF((s) => ({ ...s, tried: true }));
      return;
    }
    try {
      const t = await create.mutateAsync({
        topic: f.topic,
        transactionRef: f.tx || null,
        message: f.msg.trim(),
        ...(signedIn ? {} : { email: f.email.trim() }),
      });
      setSheet(false);
      setOpenTicket(t.ref);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t send your request.');
    }
  };

  return (
    <Screen>
      <ScrollBody bottom={108}>
        <TopBar title="Help & support" leadingLabel={signedIn ? 'Back to Profile' : 'Back'} />
        <Banner tone="warn" icon="shield">
          Support only talks to you inside this app. We’ll never ask for your password, 2FA codes or recovery phrase, or ask you to send funds.
        </Banner>

        <Sec top={22}>Your requests</Sec>
        {!signedIn ? (
          <Card style={{ padding: 14 }}>
            <T size={13.5} lh={1.55} color="text2">
              You’re not signed in. Send a request below with the email on your account and we’ll start identity-checked account recovery.
            </T>
          </Card>
        ) : (
          <Card>
            {(tickets.data ?? []).map((t, i) => {
              const isOpen = openTicket === t.ref;
              const [label, tone] = STATUS[t.status];
              return (
                <View key={t.ref}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    onPress={() => setOpenTicket(isOpen ? null : t.ref)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 60,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: c.border,
                      backgroundColor: pressed ? c.sunken : 'transparent',
                    })}
                  >
                    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                      <T weight={500}>{t.subject}</T>
                      <T size={12} mono color="text3">{`${t.ref} · ${md(t.createdAt)}`}</T>
                    </View>
                    <Status tone={tone} label={label} base="text" />
                  </Pressable>
                  {isOpen ? (
                    <View style={{ gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
                      {t.messages.map((m, k) => (
                        <View
                          key={k}
                          style={{
                            alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
                            maxWidth: '88%',
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            backgroundColor: m.from === 'me' ? c.accent : c.sunken,
                          }}
                        >
                          <T size={13} lh={1.5} rawColor={m.from === 'me' ? c.onAccent : c.text}>
                            {m.text}
                          </T>
                          <T size={11} lh={1.5} rawColor={m.from === 'me' ? c.onAccent : c.text} style={{ opacity: 0.7, marginTop: 4 }}>
                            {m.meta}
                          </T>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {tickets.data?.length === 0 ? (
              <T size={13.5} lh={1.55} color="text2" style={{ padding: 14 }}>
                No requests yet.
              </T>
            ) : null}
          </Card>
        )}

        <Sec top={22}>Help topics</Sec>
        <InputWrap height={48}>
          <Icon name="search" size="sm" color="text3" />
          <TextInput
            accessibilityLabel="Search help topics"
            placeholder="Search help"
            placeholderTextColor={c.placeholder}
            value={q}
            onChangeText={setQ}
            style={[
              { flex: 1, minWidth: 0, height: '100%', padding: 0, paddingHorizontal: 2, fontSize: 15, fontFamily: familyFor(400), color: c.text },
              { outlineStyle: 'none' } as object,
            ]}
          />
        </InputWrap>
        <Card style={{ marginTop: 10 }}>
          {topics.map((t, i) => {
            const isOpen = openTopic === t.id;
            return (
              <View key={t.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() => setOpenTopic(isOpen ? null : t.id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 56,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                    backgroundColor: pressed ? c.sunken : 'transparent',
                  })}
                >
                  <T style={{ flex: 1 }}>{t.title}</T>
                  <Chevron open={isOpen} />
                </Pressable>
                {isOpen ? (
                  <T size={13.5} lh={1.55} color="text2" style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                    {t.body}
                  </T>
                ) : null}
              </View>
            );
          })}
          {topics.length === 0 ? (
            <T size={13.5} lh={1.55} color="text2" style={{ paddingTop: 14, paddingHorizontal: 14, paddingBottom: 14 }}>
              No topics match. Send us a request instead.
            </T>
          ) : null}
        </Card>
      </ScrollBody>
      <Footer>
        <Button
          label="New request"
          flex={1}
          onPress={() => {
            setF({ topic: '', tx: '', msg: '', email: '', tried: false });
            setError('');
            setSheet(true);
          }}
        />
      </Footer>

      <Sheet open={sheet} onClose={() => setSheet(false)} scrim="deep" shadow="strong" maxHeight={0.9} accessibilityLabel="New support request">
        <Grab />
        <T size={18} weight={600} style={{ marginBottom: 14 }} accessibilityRole="header">
          New support request
        </T>
        <View style={{ gap: 14 }}>
          {!signedIn ? (
            <Field>
              <Label nativeID="nr-email">Email on your account</Label>
              <TextField
                accessibilityLabelledBy="nr-email"
                height={50}
                value={f.email}
                onChangeText={(v) => setF((s) => ({ ...s, email: v.trim() }))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
                invalid={f.tried && !EMAIL.test(f.email.trim())}
              />
              {f.tried && !EMAIL.test(f.email.trim()) ? <ErrorText>Enter the email you signed up with.</ErrorText> : null}
            </Field>
          ) : null}
          <Field>
            <Label>Topic</Label>
            <Select
              label="Topic"
              height={50}
              value={f.topic}
              onChange={(v) => setF((s) => ({ ...s, topic: v }))}
              options={[{ value: '', label: 'Choose a topic' }, ...TOPIC_OPTIONS.map((t) => ({ value: t, label: t }))]}
              invalid={f.tried && !f.topic}
            />
            {f.tried && !f.topic ? <ErrorText>Choose a topic.</ErrorText> : null}
          </Field>
          <Field>
            <Label optional>Related transaction</Label>
            <Select
              label="Related transaction"
              height={50}
              value={f.tx}
              onChange={(v) => setF((s) => ({ ...s, tx: v }))}
              options={txOptions.some((o) => o.value === f.tx) ? txOptions : [...txOptions, { value: f.tx, label: f.tx }]}
            />
          </Field>
          <Field>
            <Label nativeID="nr-msg">What happened?</Label>
            <InputWrap height={null} invalid={f.tried && !msgOk}>
              <TextInput
                accessibilityLabelledBy="nr-msg"
                multiline
                textAlignVertical="top"
                placeholder="Describe the issue. Don’t include passwords or codes."
                placeholderTextColor={c.placeholder}
                value={f.msg}
                onChangeText={(v) => setF((s) => ({ ...s, msg: v }))}
                style={[
                  {
                    flex: 1,
                    height: 110,
                    paddingVertical: 12,
                    paddingHorizontal: 2,
                    fontSize: 14,
                    lineHeight: 14 * 1.45,
                    fontFamily: familyFor(400),
                    color: c.text,
                  },
                  { outlineStyle: 'none' } as object,
                ]}
              />
            </InputWrap>
            <Help>{`${f.msg.trim().length} characters · at least 20`}</Help>
            {f.tried && !msgOk ? <ErrorText>Tell us a little more so we can help.</ErrorText> : null}
          </Field>
        </View>
        {error ? (
          <Banner tone="error" alert style={{ marginTop: 14 }}>
            {error}
          </Banner>
        ) : null}
        <Button label="Send request" loading={create.isPending} onPress={submit} style={{ marginTop: 16 }} />
      </Sheet>
    </Screen>
  );
};
