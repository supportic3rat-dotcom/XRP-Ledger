import { asset as assetSpec } from '@xrp/ledger';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Segmented } from '@/components/Segmented';
import { Status } from '@/components/Status';
import { Field, Label, TextField } from '@/components/Form';
import { T } from '@/components/T';
import type { TxItem } from '../data/types';
import { useOps, useOpsAction, useStaffSession } from '../hooks';
import { BlockNote, Empty, FilterTabs, Journal, Loading, OpsScreen, Panel, SecT, Timeline } from '../ui';

const FILTERS: { key: TxItem['kind'] | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposits' },
  { key: 'withdrawal', label: 'Withdrawals' },
  { key: 'exchange', label: 'Exchange' },
  { key: 'yield', label: 'Yield' },
  { key: 'loan', label: 'Loans' },
];

export const TransactionsScreen = () => {
  const router = useRouter();
  const q = useOps('transactions', (d) => d.transactions());
  const [filter, setFilter] = useState<TxItem['kind'] | 'all'>('all');
  const txs = q.data ?? [];
  const list = txs.filter((t) => filter === 'all' || t.kind === filter);

  return (
    <OpsScreen tab title="Transactions" sub="Every customer movement with its ledger journal and on-ledger evidence." refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <FilterTabs
        label="Filter transactions"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ ...f, count: f.key === 'all' ? txs.length : txs.filter((x) => x.kind === f.key).length }))}
      />
      {!q.data ? (
        <Loading error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card>
          {list.map((r, i) => (
            <Row key={r.id} first={i === 0} chevron onPress={() => router.push(`/ops/tx/${r.id}`)} accessibilityLabel={`${r.ref}, ${r.type}, ${r.amount}, ${r.status}`}>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T size={12.5} mono weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {r.ref}
                  </T>
                  <T size={13.5} num weight={500}>
                    {r.amount}
                  </T>
                </View>
                <T size={13}>{r.type}</T>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T size={11.5} mono color="text3">
                    {`${r.customer} · ${r.time}`}
                  </T>
                  <Status tone={r.tone} label={r.status} />
                </View>
              </View>
            </Row>
          ))}
          {list.length === 0 ? <Empty>No transactions in this category.</Empty> : null}
        </Card>
      )}
    </OpsScreen>
  );
};

/** An approved non-XRP withdrawal: staff send it from the platform wallet, then record the hash (or mark it failed). */
const ManualSendPanel = ({ t, disabled }: { t: TxItem; disabled: boolean }) => {
  const { data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const [mode, setMode] = useState<'sent' | 'failed'>('sent');
  const [value, setValue] = useState('');
  const network = assetSpec(t.asset).network;
  return (
    <Card style={{ padding: 14, gap: 12 }}>
      <SecT>Send this withdrawal</SecT>
      <T size={12.5} lh={1.45} color="text3" style={{ marginTop: -8 }}>
        {`Send the ${t.asset} from the platform's ${network} wallet to the address above, then record the transaction hash. The fee is booked and the customer is notified. If it can't be sent, mark it failed to return the funds.`}
      </T>
      <Segmented
        label="Outcome"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setValue('');
        }}
        options={[
          { value: 'sent', label: 'Sent' },
          { value: 'failed', label: 'Failed' },
        ]}
      />
      <Field>
        <Label nativeID="ms-val">{mode === 'sent' ? 'Network transaction hash' : 'Reason (goes into the audit log)'}</Label>
        <TextField
          accessibilityLabelledBy="ms-val"
          value={value}
          onChangeText={(v) => setValue(mode === 'sent' ? v.trim() : v)}
          placeholder={mode === 'sent' ? 'Paste from the block explorer' : 'Why couldn’t it be sent?'}
          mono={mode === 'sent'}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={mode === 'failed'}
          height={mode === 'failed' ? null : 48}
          minHeight={mode === 'failed' ? 88 : undefined}
          style={mode === 'failed' ? { minHeight: 72, paddingVertical: 12, textAlignVertical: 'top' } : undefined}
        />
      </Field>
      <Button
        label={mode === 'sent' ? 'Mark as sent' : 'Mark as failed · return funds'}
        variant={mode === 'sent' ? 'primary' : 'secondary'}
        textColor={mode === 'sent' ? undefined : 'neg'}
        size={48}
        disabled={disabled}
        loading={pending}
        onPress={() =>
          void run(
            () => data.completeWithdrawal(t.id, mode === 'sent' ? { action: 'sent', txHash: value } : { action: 'failed', reason: value }),
            () => setValue(''),
          )
        }
      />
      <BlockNote>{disabled ? 'Read-only role: you can view but not act.' : ''}</BlockNote>
    </Card>
  );
};

const SETTLE: Record<NonNullable<TxItem['settle']>, { title: string; body: string; button: string }> = {
  usd: {
    title: 'Pay this sale',
    body: 'The customer accepted the quote. Send the USD amount by bank transfer to the account above (the name must match the customer), then record the transfer reference.',
    button: 'Mark as paid',
  },
  swap: { title: 'Complete this swap', body: 'The customer accepted the quote. Completing it credits the coin they bought to their balance.', button: 'Mark as completed' },
  loan: {
    title: 'Pay out this loan',
    body: 'Compliance approved it and the collateral is locked. Send the loan by bank transfer to the account above (the name must match the customer), then record the reference. Interest starts today.',
    button: 'Mark as funded',
  },
  repayment: {
    title: 'Confirm this repayment',
    body: 'Check the customer’s transfer has arrived in the platform bank account with the payment reference, then record the bank reference. It’s applied to the loan at once.',
    button: 'Mark as received',
  },
};

/** Something staff complete by hand: a USD sale or swap, a loan payout, or a bank repayment. The customer is notified. */
const SettlePanel = ({ t, disabled }: { t: TxItem; disabled: boolean }) => {
  const { data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const [reference, setReference] = useState('');
  if (!t.settle) return null;
  const kind = t.settle;
  const copy = SETTLE[kind];
  return (
    <Card style={{ padding: 14, gap: 12 }}>
      <SecT>{copy.title}</SecT>
      <T size={12.5} lh={1.45} color="text3" style={{ marginTop: -8 }}>
        {copy.body}
      </T>
      {kind !== 'swap' ? (
        <Field>
          <Label nativeID="settle-ref">Bank transfer reference</Label>
          <TextField
            accessibilityLabelledBy="settle-ref"
            value={reference}
            onChangeText={setReference}
            placeholder="From the bank’s confirmation"
            mono
            autoCapitalize="characters"
            autoCorrect={false}
            height={48}
          />
        </Field>
      ) : null}
      <Button
        label={copy.button}
        size={48}
        disabled={disabled}
        loading={pending}
        onPress={() => void run(() => data.settle(t.id, kind, reference.trim()), () => setReference(''))}
      />
      <BlockNote>{disabled ? 'Read-only role: you can view but not act.' : ''}</BlockNote>
    </Card>
  );
};

export const TransactionScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me } = useStaffSession();
  const q = useOps('transactions', (d) => d.transactions());
  const t = q.data?.find((x) => x.id === id);

  if (!t) {
    return (
      <OpsScreen title="Transaction" backLabel="Back to transactions">
        {q.data ? <Banner tone="info">This transaction couldn’t be found.</Banner> : <Loading error={q.error} onRetry={() => void q.refetch()} />}
      </OpsScreen>
    );
  }
  return (
    <OpsScreen title={`${t.type} · ${t.amount}`} backLabel="Back to transactions" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <T size={12.5} mono color="text3" style={{ flexShrink: 1 }}>
            {`${t.ref} · ${t.customer}`}
          </T>
          <Status tone={t.tone} label={t.status} />
        </View>
        <KV padX={0} padY={0} rowPad={9} num items={t.rows.map((r) => ({ k: r.k, v: r.v, mono: r.mono }))} />
        {t.journal.length ? (
          <View>
            <SecT>Ledger journal</SecT>
            <Journal rows={t.journal} />
          </View>
        ) : null}
        <View>
          <SecT>Timeline</SecT>
          <Timeline rows={t.timeline} />
        </View>
        {t.manualSend ? <ManualSendPanel key={t.id} t={t} disabled={me.role === 'auditor'} /> : null}
        {t.settle ? <SettlePanel key={t.id} t={t} disabled={me.role === 'auditor'} /> : null}
        {t.queueId ? <Button label="Open in approval queue" variant="secondary" size={48} onPress={() => router.push(`/ops/approval/${t.queueId}`)} /> : null}
      </Panel>
    </OpsScreen>
  );
};
