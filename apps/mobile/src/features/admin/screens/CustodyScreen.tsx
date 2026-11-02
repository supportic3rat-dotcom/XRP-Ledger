import { formatAmount, isNetworkAddress, walletNetwork, WALLET_NETWORKS } from '@xrp/ledger';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ErrorText, Field, Help, Label, TextField } from '@/components/Form';
import { KV } from '@/components/KV';
import { Select } from '@/components/Select';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { api } from '@/data';
import { useTheme } from '@/theme';
import { shortAddr, xrp0, xrp2 } from '../data/format';
import type { AddedWallet, ReserveNeed } from '../data/types';
import { useOps, useOpsAction, useStaffSession } from '../hooks';
import { BlockNote, Line, Loading, OpsScreen, Panel, SecT } from '../ui';

/** Share of holdings to one decimal, rounded half-up in integer maths. */
const share = (part: bigint, total: bigint) => (total === 0n ? '0.0%' : `${(Number((part * 2000n + total) / (2n * total)) / 10).toFixed(1)}%`);

const NETWORK_OPTIONS = WALLET_NETWORKS.map((n) => ({ value: n.id, label: `${n.name} · ${n.assets.join(', ')}` }));

/** One added wallet with its live balance, read from the public network. */
const AddedWalletRow = ({ w, first, canEdit }: { w: AddedWallet; first: boolean; canEdit: boolean }) => {
  const { data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const balances = useQuery({ queryKey: ['ops', 'wallet-balance', w.network, w.address], queryFn: () => api.walletBalance(w.network, w.address) });
  const held = Object.entries(balances.data ?? {}).filter(([, units]) => units > 0n);
  const amounts = balances.isError ? 'Balance unavailable' : !balances.data ? 'Reading…' : held.map(([a, units]) => formatAmount(units, a)).join(' · ') || 'Empty';
  return (
    <Line first={first} style={{ alignItems: 'flex-start' }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={13.5} weight={500}>
          {w.name}
        </T>
        <T size={12} mono color="text3">
          {shortAddr(w.address, 9, 4)}
        </T>
        <T size={12} color="text3">
          {walletNetwork(w.network)?.name ?? w.network}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6, flexShrink: 1 }}>
        <T size={13} num weight={500} align="right">
          {amounts}
        </T>
        {w.reserve ? <Status tone="ok" label="Earn reserve" /> : null}
        {canEdit ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
            <Button
              label={w.reserve ? 'Stop using as reserve' : 'Use as Earn reserve'}
              variant="secondary"
              size={36}
              disabled={pending}
              onPress={() => void run(() => data.setWalletReserve(w.id, !w.reserve))}
            />
            <Button label="Remove" variant="secondary" textColor="neg" size={36} disabled={pending} onPress={() => void run(() => data.removeWallet(w.id))} />
          </View>
        ) : null}
      </View>
    </Line>
  );
};

/** 12 months of minimum Earn rewards per coin, against what the reserve wallets hold on the network right now. */
const EarnReserve = ({ needs, wallets }: { needs: ReserveNeed[]; wallets: AddedWallet[] }) => {
  const reserves = wallets.filter((w) => w.reserve);
  const balances = useQueries({
    queries: reserves.map((w) => ({ queryKey: ['ops', 'wallet-balance', w.network, w.address], queryFn: () => api.walletBalance(w.network, w.address) })),
  });
  const allRead = balances.every((b) => b.isSuccess);
  const heldOf = (asset: string) => balances.reduce((sum, b) => sum + (b.data?.[asset] ?? 0n), 0n);
  return (
    <Panel style={{ gap: 0 }}>
      <SecT>Earn reserve · 12 months of minimum rewards</SecT>
      {needs.map((n, i) => {
        const held = heldOf(n.asset);
        const covered = held >= n.neededUnits;
        return (
          <Line key={n.asset} first={i === 0} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={13.5} weight={500}>
                {n.asset}
              </T>
              <T size={12} num color="text3">{`Need ${formatAmount(n.neededUnits, n.asset)} on ${formatAmount(n.allocatedUnits, n.asset)} allocated`}</T>
              <T size={12} num color="text3">{`Held ${formatAmount(held, n.asset)}`}</T>
            </View>
            {covered ? (
              <Status tone="ok" label="Covered" />
            ) : allRead ? (
              <Status tone="bad" label={`Short ${formatAmount(n.neededUnits - held, n.asset)}`} />
            ) : (
              <Status tone="wait" label="Checking" />
            )}
          </Line>
        );
      })}
      {needs.length === 0 ? (
        <T size={13} color="text3">
          No coins are allocated to Earn yet.
        </T>
      ) : null}
      <Help>Reserve wallets must hold only the platform’s own money. Mark one under Added wallets. Wallets taking customer deposits can’t be used.</Help>
    </Panel>
  );
};

/** Compliance adds more platform wallets on any network; everyone else can see them. */
const AddedWallets = ({ wallets, canEdit }: { wallets: AddedWallet[]; canEdit: boolean }) => {
  const { data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const [name, setName] = useState('');
  const [network, setNetwork] = useState('xrp');
  const [address, setAddress] = useState('');
  const [tried, setTried] = useState(false);
  const net = walletNetwork(network) ?? WALLET_NETWORKS[0]!;
  const nameErr = tried && !name.trim() ? 'Give the wallet a name.' : '';
  const addrErr = tried && !isNetworkAddress(network, address) ? `That isn’t a valid ${net.name} address.` : '';

  const add = () => {
    setTried(true);
    if (!name.trim() || !isNetworkAddress(network, address)) return;
    void run(
      () => data.addWallet(name.trim(), network, address.trim()),
      () => {
        setName('');
        setAddress('');
        setTried(false);
      },
    );
  };

  return (
    <Panel style={{ gap: 0 }}>
      <SecT>Added wallets</SecT>
      {wallets.map((w, i) => (
        <AddedWalletRow key={w.id} w={w} first={i === 0} canEdit={canEdit} />
      ))}
      {wallets.length === 0 ? (
        <T size={13} color="text3">
          No wallets added yet.
        </T>
      ) : null}
      {canEdit ? (
        <View style={{ gap: 12, marginTop: 14 }}>
          <SecT>Add a wallet</SecT>
          <Field>
            <Label nativeID="aw-name">Wallet name</Label>
            <TextField accessibilityLabelledBy="aw-name" value={name} onChangeText={setName} invalid={!!nameErr} maxLength={60} placeholder="e.g. Treasury BTC" height={48} />
            <ErrorText>{nameErr}</ErrorText>
          </Field>
          <Field>
            <Label nativeID="aw-net">Network</Label>
            <Select label="Network" value={network} options={NETWORK_OPTIONS} onChange={setNetwork} height={48} />
          </Field>
          <Field>
            <Label nativeID="aw-addr">{`${net.name} address`}</Label>
            <TextField
              accessibilityLabelledBy="aw-addr"
              value={address}
              onChangeText={(v) => setAddress(v.trim())}
              invalid={!!addrErr}
              mono
              autoCapitalize="none"
              autoCorrect={false}
              height={48}
            />
            <ErrorText>{addrErr}</ErrorText>
            <Help>{net.addressHint}</Help>
          </Field>
          <Help>Adding a wallet doesn’t change where customers deposit. To send deposits here, set it as the coin’s address under Assets.</Help>
          <Button label="Add wallet" size={48} loading={pending} onPress={add} />
        </View>
      ) : null}
    </Panel>
  );
};

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
                <SecT>Platform wallets</SecT>
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

              <AddedWallets wallets={c.added} canEdit={isComp} />
              <EarnReserve needs={c.reserveNeeds} wallets={c.added} />

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
