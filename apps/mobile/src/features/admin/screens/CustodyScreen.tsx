import { View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { KV } from '@/components/KV';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { useTheme } from '@/theme';
import { shortAddr, xrp0, xrp2 } from '../data/format';
import { useOps, useOpsAction, useStaffSession } from '../hooks';
import { BlockNote, Line, Loading, OpsScreen, Panel, SecT } from '../ui';

/** Share of holdings to one decimal, rounded half-up in integer maths. */
const share = (part: bigint, total: bigint) => (total === 0n ? '0.0%' : `${(Number((part * 2000n + total) / (2n * total)) / 10).toFixed(1)}%`);

export const CustodyScreen = () => {
  const { c: color } = useTheme();
  const { me, data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const q = useOps('custody', (d) => d.custody());
  const c = q.data;

  return (
    <OpsScreen title="Custody" sub="Wallets, signing policy and limits. Policy changes need approval from a second role." refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {!c ? (
        <Loading error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        (() => {
          const total = c.wallets.reduce((s, w) => s + w.balanceDrops, 0n);
          const hot = c.wallets.find((w) => w.tier === 'hot');
          const pct = c.limits.platformDailyDrops === 0n ? 0 : Number((c.limits.outflowTodayDrops * 1000n) / c.limits.platformDailyDrops) / 10;
          const p = c.pendingChange;
          const isComp = me.role === 'compliance';
          const pStatus =
            p?.status === 'approved'
              ? `Approved${p.decidedByMe ? ' by you' : ''} · takes effect after 24-hour delay`
              : p?.status === 'declined'
                ? `Declined${p.decidedByMe ? ' by you' : ''}`
                : 'Waiting for Compliance approval';
          const pTone = p?.status === 'approved' ? 'ok' : p?.status === 'declined' ? 'bad' : 'wait';
          const block =
            p?.status !== 'pending'
              ? ''
              : isComp
                ? ''
                : me.role === 'auditor'
                  ? 'Read-only role: you can view but not act.'
                  : 'Separation of duties: requested by Operations, so it needs Compliance approval.';
          const disabled = !isComp || p?.status !== 'pending' || pending;
          return (
            <>
              <Panel style={{ gap: 0 }}>
                <SecT>Wallets · [Custody provider]</SecT>
                {c.wallets.map((w, i) => (
                  <Line key={w.name} first={i === 0} style={{ alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T size={13.5} weight={500}>
                        {w.name}
                      </T>
                      <T size={12} mono color="text3">
                        {shortAddr(w.address, w.tier === 'warm' || w.tier === 'cold' ? 10 : 9, 4)}
                      </T>
                      <T size={12} color="text3">
                        {w.signing}
                      </T>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <T size={13.5} num weight={500}>
                        {`${xrp2(w.balanceDrops)} XRP`}
                      </T>
                      <T size={12} num color="text3">
                        {share(w.balanceDrops, total)}
                      </T>
                    </View>
                  </Line>
                ))}
                <Line>
                  <T size={14} weight={600} style={{ flex: 1 }}>
                    Total
                  </T>
                  <T size={14} num weight={600}>
                    {`${xrp2(total)} XRP`}
                  </T>
                </Line>
                {hot?.ceilingDrops ? (
                  <Banner tone="info" size={12.5} style={{ marginTop: 10 }}>
                    {`Hot wallet is at ${xrp0(hot.balanceDrops)} of its ${xrp0(hot.ceilingDrops)} XRP ceiling. Top-ups from warm need 2 of 3 signers; keys never leave the provider’s security boundary.`}
                  </Banner>
                ) : null}
              </Panel>

              <Panel style={{ gap: 0 }}>
                <SecT>{`Signing policy · ${c.policyVersion}`}</SecT>
                <KV padX={0} padY={0} rowPad={9} items={c.policy.map(([k, v]) => ({ k, v }))} />
                <SecT top={16}>Signers</SecT>
                {c.signers.map((s, i) => (
                  <Line key={s.name} first={i === 0}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <T size={13.5} weight={500}>
                        {s.name}
                      </T>
                      <T size={12} color="text3">
                        {s.meta}
                      </T>
                    </View>
                    <Status tone={s.status === 'Active' ? 'ok' : 'off'} label={s.status} />
                  </Line>
                ))}
              </Panel>

              <Panel>
                <View>
                  <SecT>Limits</SecT>
                  <KV
                    padX={0}
                    padY={0}
                    rowPad={9}
                    num
                    items={[
                      { k: 'Per customer, daily', v: `${xrp0(c.limits.customerDailyDrops)} XRP` },
                      { k: 'Per transaction (auto-sign)', v: `${xrp0(c.limits.autoSignDrops)} XRP` },
                      { k: 'Platform outflow, daily', v: `${xrp0(c.limits.outflowTodayDrops)} of ${xrp0(c.limits.platformDailyDrops)} XRP` },
                    ]}
                  />
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={`${pct} percent of daily outflow limit used`}
                    style={{ height: 6, borderRadius: 3, backgroundColor: color.sunken, overflow: 'hidden', marginTop: 10 }}
                  >
                    <View style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: color.accent }} />
                  </View>
                </View>
                <View>
                  <SecT>Pending policy change</SecT>
                  {p ? (
                    <View style={{ gap: 10 }}>
                      <View style={{ gap: 4 }}>
                        <T size={13.5} weight={500}>
                          {p.title}
                        </T>
                        <T size={12.5} lh={1.4} color="text3">
                          {`Requested by ${p.requestedRole === 'operations' ? 'Operations' : 'Compliance'} · ${p.requestedBy} · ${p.when} · “${p.reason}”`}
                        </T>
                        <Status tone={pTone} label={pStatus} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Button label="Decline" variant="secondary" textColor="neg" size={48} flex={1} disabled={disabled} onPress={() => void run(() => data.decidePolicy(p.id, 'decline'))} />
                        <Button label="Approve change" size={48} flex={1} disabled={disabled} onPress={() => void run(() => data.decidePolicy(p.id, 'approve'))} />
                      </View>
                      <BlockNote>{block}</BlockNote>
                    </View>
                  ) : (
                    <T size={13} color="text3">
                      No pending changes.
                    </T>
                  )}
                </View>
              </Panel>
            </>
          );
        })()
      )}
    </OpsScreen>
  );
};
