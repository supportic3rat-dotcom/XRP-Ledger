import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ErrorText, Field, Label, TextField } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { nextStep, queueStatus } from '../data/status';
import { type QueueItem, ROLES, type Staff } from '../data/types';
import { approveBlock, canReject } from '../data/rules';
import { useOps, useOpsAction, useStaffSession } from '../hooks';
import { BlockNote, CheckRow, Journal, Line, Loading, OpsScreen, Panel, SecT, Timeline } from '../ui';

const REASONS = [
  { value: 'screening', label: 'Destination failed screening' },
  { value: 'evidence', label: 'Insufficient supporting evidence' },
  { value: 'limits', label: 'Exceeds customer limits' },
  { value: 'customer', label: 'Customer asked to cancel' },
];

const approveLabelOf = (it: QueueItem): string =>
  it.kind === 'deposit'
    ? it.type.startsWith('Deposit confirmation')
      ? `Confirmed on network · credit ${it.customer}`
      : `Approve attribution to ${it.claimant ?? 'claimant'}`
    : it.kind === 'exchange'
      ? 'Approve · request quote'
      : 'Approve';

/** Approve / Reject… with the reason form. Shown only while the item is undecided. */
const DecisionPanel = ({ it, me }: { it: QueueItem; me: Staff }) => {
  const { data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const [rejecting, setRejecting] = useState(false);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const block = approveBlock(it, me);
  const err = tried && (!code || note.trim().length < 10) ? 'Choose a reason and write at least a short note — it goes into the audit log.' : '';
  const reset = () => {
    setRejecting(false);
    setCode('');
    setNote('');
    setTried(false);
  };

  if (rejecting) {
    return (
      <View style={{ gap: 12 }}>
        <Field>
          <Label>Rejection reason</Label>
          <Select label="Rejection reason" value={code} options={REASONS} onChange={setCode} placeholder="Select a reason" height={48} invalid={tried && !code} />
        </Field>
        <Field>
          <Label nativeID="rej-note">Note for the audit log</Label>
          <TextField
            accessibilityLabelledBy="rej-note"
            value={note}
            onChangeText={setNote}
            placeholder="What did you check, and why reject?"
            multiline
            height={null}
            minHeight={96}
            style={{ minHeight: 80, paddingVertical: 12, textAlignVertical: 'top' }}
            invalid={tried && note.trim().length < 10}
          />
        </Field>
        <ErrorText>{err}</ErrorText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Back" variant="secondary" size={48} flex={1} onPress={reset} />
          <Button
            label="Confirm rejection"
            variant="secondary"
            textColor="neg"
            size={48}
            flex={1}
            loading={pending}
            onPress={() => {
              if (!code || note.trim().length < 10) {
                setTried(true);
                return;
              }
              void run(() => data.decide(it.id, 'reject', code, note.trim()), reset);
            }}
          />
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Button label={approveLabelOf(it)} size={48} disabled={!!block} loading={pending} onPress={() => void run(() => data.decide(it.id, 'approve'))} />
      <Button label="Reject…" variant="secondary" textColor="neg" size={48} disabled={!canReject(it, me.role) || pending} onPress={() => setRejecting(true)} />
      <BlockNote>{block}</BlockNote>
    </View>
  );
};

export const ApprovalScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useStaffSession();
  const q = useOps('queue', (d) => d.queue());
  const it = q.data?.find((x) => x.id === id);

  if (!it) {
    return (
      <OpsScreen title="Approval" backLabel="Back to queue">
        {q.data ? <Banner tone="info">This request is no longer in the queue.</Banner> : <Loading error={q.error} onRetry={() => void q.refetch()} />}
      </OpsScreen>
    );
  }

  const [status, tone] = queueStatus(it);
  const rejected = it.decided?.kind === 'rejected';
  const done = it.decided !== null || it.approvals.length >= it.required;
  const mine = it.approvals.some((a) => a.staffId === me.id);
  const outcome = rejected
    ? `Rejected. Customer notified with your reason${it.journal.length ? '; reserved funds released via compensating entry.' : '.'}`
    : done
      ? nextStep(it.kind)
      : mine
        ? 'Your approval is recorded. Waiting for a second approver.'
        : '';

  return (
    <OpsScreen title={`${it.type} · ${it.amount}`} backLabel="Back to queue" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Panel>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <T size={12.5} mono color="text3" style={{ flexShrink: 1 }}>
              {`${it.ref} · ${it.customer}`}
            </T>
            <Status tone={tone} label={status} />
          </View>
          <T size={12.5} lh={1.45} color="text2">
            {it.summary}
          </T>
        </View>

        <View>
          <SecT>Checks</SecT>
          {it.checks.map((c, i) => (
            <CheckRow key={c.label} {...c} first={i === 0} />
          ))}
        </View>

        <View>
          <SecT>{`Approvals · ${it.approvals.length} of ${it.required} required`}</SecT>
          {it.approvals.map((a, i) => (
            <Line key={a.staffId} first={i === 0}>
              <Icon name="check" size="sm" color="pos" />
              <T size={13} style={{ flex: 1 }}>
                {`${ROLES[a.role].name} · ${a.staffId === me.id ? 'you' : a.who}`}
              </T>
              <T size={12} num color="text3">
                {a.at}
              </T>
            </Line>
          ))}
          {it.required > 1 ? (
            <Banner tone="info" style={{ marginTop: 6 }} size={12.5}>
              Over 1,000 XRP: two approvals from different people, at least one from Compliance.
            </Banner>
          ) : null}
        </View>

        {it.journal.length ? (
          <View>
            <SecT>Ledger journal</SecT>
            <Journal rows={it.journal} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Icon name="check" size="xs" color="pos" />
              <T size={12} color="pos">
                Balanced · posted entries are never edited
              </T>
            </View>
          </View>
        ) : null}

        <View>
          <SecT>Audit trail</SecT>
          <Timeline rows={it.audit} />
        </View>

        {!done && !mine ? <DecisionPanel key={it.id} it={it} me={me} /> : null}
        {outcome ? (
          <Banner tone={rejected ? 'error' : 'info'} icon={rejected ? 'xCircle' : 'checkCircle'}>
            {outcome}
          </Banner>
        ) : null}
      </Panel>
    </OpsScreen>
  );
};
