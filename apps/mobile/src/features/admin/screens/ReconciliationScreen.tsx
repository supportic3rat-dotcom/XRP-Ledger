import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Banner } from '@/components/Banner';
import { KV } from '@/components/KV';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { useTheme } from '@/theme';
import { xrp2, xrp6, xrpAuto, xrpDiff } from '../data/format';
import type { ReconWalletRow } from '../data/types';
import { useOps, useOpsAction, useStaffSession } from '../hooks';
import { Line, Loading, OpsScreen, Panel, SecT } from '../ui';

/** Hot wallet rows show 6 decimals (fees land there); warm/cold 2; totals 2 unless sub-cent. */
const cell = (w: ReconWalletRow, v: bigint) => (w.tier === 'hot' ? xrp6(v) : w.tier === 'total' ? xrpAuto(v) : xrp2(v));

export const ReconciliationScreen = () => {
  const router = useRouter();
  const { c } = useTheme();
  const { me, data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const q = useOps('recon', (d) => d.recon());
  const r = q.data;

  return (
    <OpsScreen
      title="Reconciliation"
      sub="Internal ledger, custody provider and XRP Ledger must agree. Differences become exceptions."
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
    >
      {!r ? (
        <Loading error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        (() => {
          const open = r.exceptions.filter((e) => e.status !== 'resolved');
          const canOps = me.role === 'operations';
          const holdings = r.wallets.find((w) => w.tier === 'total')?.provider ?? 0n;
          const liabilities = r.customerLiabilitiesDrops + r.suspenseDrops;
          const ratio = liabilities === 0n ? 100 : Number((holdings * 10_000n) / liabilities) / 100;
          const roleNote = canOps
            ? ''
            : me.role === 'auditor'
              ? 'Read-only role: you can view exceptions but not resolve them.'
              : 'Ledger adjustments are posted by Operations; Compliance reviews them in the audit log.';
          return (
            <>
              <Panel style={{ gap: 12 }}>
                <View style={{ gap: 2 }}>
                  <T size={14} weight={600}>
                    <T size={14} weight={600} mono>
                      {r.runRef.replace(/-0+(\d)/, '-$1')}
                    </T>
                    {` · ${r.when}`}
                  </T>
                  <T size={12.5} lh={1.4} color="text3">
                    {`Internal ledger vs [Custody provider] vs XRP Ledger (validated ledger ${r.validatedLedger.toLocaleString('en-US')})`}
                  </T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Status tone={open.length ? 'wait' : 'ok'} label={open.length ? `${open.length} exception${open.length > 1 ? 's' : ''} open` : 'Balanced'} />
                  <Button label="Run now" variant="secondary" size={36} disabled={me.role === 'auditor'} loading={pending} onPress={() => void run(() => data.runRecon())} />
                </View>
              </Panel>

              <Panel style={{ gap: 0 }}>
                <SecT>Holdings by wallet · XRP</SecT>
                {r.wallets.map((w, i) => {
                  const diff = w.chain - w.internal;
                  return (
                    <View key={w.name} style={{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border, gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <T size={13.5} weight={w.tier === 'total' ? 600 : 500}>
                          {w.name}
                        </T>
                        <T size={13} num weight={500} color={diff === 0n ? 'pos' : 'neg'}>
                          {`Diff ${xrpDiff(diff)}`}
                        </T>
                      </View>
                      <KV
                        padX={0}
                        padY={0}
                        rowPad={3}
                        num
                        items={[
                          { k: 'Internal ledger', v: cell(w, w.internal), valueSize: 12.5 },
                          { k: 'Custody provider', v: cell(w, w.provider), valueSize: 12.5 },
                          { k: 'On ledger', v: cell(w, w.chain), valueSize: 12.5 },
                        ].map((x) => ({ ...x, k: <T size={12.5} color="text3">{x.k}</T> }))}
                        style={{ borderTopWidth: 0 }}
                      />
                    </View>
                  );
                })}
                <SecT top={16}>Liabilities · XRP</SecT>
                <KV
                  padX={0}
                  padY={0}
                  rowPad={9}
                  num
                  items={[
                    { k: 'Customer balances (available, reserved, yield, collateral)', v: xrp2(r.customerLiabilitiesDrops) },
                    { k: 'Unattributed deposits (suspense)', v: xrp2(r.suspenseDrops) },
                    { k: 'Total liabilities', v: xrp2(liabilities) },
                    { k: 'Holdings ÷ liabilities', v: `${ratio.toFixed(2)}%`, valueColor: ratio >= 100 ? 'pos' : 'neg' },
                  ]}
                />
              </Panel>

              <Panel style={{ gap: 0 }}>
                <SecT>{`Exceptions · ${open.length} open`}</SecT>
                {r.exceptions.map((e, i) => {
                  const done = e.status === 'resolved';
                  const status = e.statusNote ?? (e.status === 'open' ? 'Open' : e.status === 'investigating' ? 'Investigating' : 'Resolved');
                  const contacted = e.statusNote?.includes('contacted');
                  return (
                    <Line key={e.id} first={i === 0} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                      <View style={{ gap: 2 }}>
                        <T size={13.5} weight={500}>
                          {e.title}
                        </T>
                        <T size={12} lh={1.4} color="text3">
                          {e.note}
                        </T>
                        <Status tone={done ? 'ok' : 'wait'} label={status} />
                      </View>
                      {done ? null : e.kind === 'unbooked_fee' ? (
                        <Button label="Book fee adjustment" variant="secondary" size={36} disabled={!canOps} loading={pending} onPress={() => void run(() => data.bookFee(e.id))} style={{ alignSelf: 'flex-start' }} />
                      ) : e.kind === 'deposit_no_tag' && e.queueId ? (
                        <Button label="Open in approval queue" variant="secondary" size={36} onPress={() => router.push(`/ops/approval/${e.queueId}`)} style={{ alignSelf: 'flex-start' }} />
                      ) : e.kind === 'provider_delay' && !contacted ? (
                        <Button
                          label="Mark provider contacted"
                          variant="secondary"
                          size={36}
                          disabled={!canOps}
                          loading={pending}
                          onPress={() => void run(() => data.contactProvider(e.id))}
                          style={{ alignSelf: 'flex-start' }}
                        />
                      ) : null}
                    </Line>
                  );
                })}
                {r.exceptions.length === 0 ? (
                  <T size={13} color="text3">
                    No exceptions. Everything agrees.
                  </T>
                ) : null}
                {roleNote ? (
                  <Banner tone="info" size={12.5} style={{ marginTop: 8 }}>
                    {roleNote}
                  </Banner>
                ) : null}
              </Panel>
            </>
          );
        })()
      )}
    </OpsScreen>
  );
};
