import { formatAmount, formatAssetPrice, formatUsd, unitsToCents } from '@xrp/ledger';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CoinLogo } from '@/components/CoinLogo';
import { Field, Help, Label, TextField } from '@/components/Form';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { Toggle } from '@/components/Toggle';
import { shortAddr } from '../data/format';
import type { AssetRow } from '../data/types';
import { useOps, useOpsAction, useStaffSession } from '../hooks';
import { Loading, OpsScreen, Panel, SecT } from '../ui';

const change = (bps: number) => `${bps >= 0 ? '+' : '−'}${Math.abs(bps / 100).toFixed(2)}%`;

/**
 * Supported assets: live price, what the platform holds for customers, deposits waiting for confirmation,
 * withdrawals waiting to be sent, and (Compliance) where customers send each asset.
 */
export const AssetsScreen = () => {
  const router = useRouter();
  const q = useOps('assets', (d) => d.assets());
  const assets = q.data ?? [];
  const totalCents = assets.reduce((s, x) => s + unitsToCents(x.liabilities, x.priceMicro, x.id), 0n);
  const waiting = assets.reduce((s, x) => s + x.pendingDeposits + x.awaitingSend, 0);

  return (
    <OpsScreen
      title="Assets"
      sub={q.data ? `${assets.length} supported assets · ${formatUsd(totalCents)} held for customers · ${waiting} items waiting on staff` : 'Supported assets'}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
    >
      {!q.data ? (
        <Loading error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card>
          {assets.map((x, i) => {
            const open = x.depositMode === 'automatic' || !!x.depositAddress;
            const n = x.pendingDeposits + x.awaitingSend;
            return (
              <Row key={x.id} first={i === 0} chevron onPress={() => router.push(`/ops/asset/${x.id}`)} accessibilityLabel={`${x.name}, ${x.network}`}>
                <CoinLogo asset={x.id} size={28} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T size={14} weight={500}>
                      {x.id}
                    </T>
                    <T size={13.5} num>
                      {x.priceMicro ? formatAssetPrice(x.priceMicro) : '—'}
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T size={12} color="text3" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {x.networks.length > 1 ? x.networks.map((n) => n.name).join(' · ') : x.network}
                    </T>
                    <T size={12} num color={x.changeBps >= 0 ? 'pos' : 'neg'}>
                      {change(x.changeBps)}
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Status
                      tone={!x.enabled ? 'off' : open ? 'ok' : 'wait'}
                      label={!x.enabled ? 'Disabled' : x.depositMode === 'automatic' ? 'Automatic' : open ? 'Open' : 'No address'}
                    />
                    <T size={12} color={n ? 'text' : 'text3'}>
                      {n ? `${x.pendingDeposits} dep · ${x.awaitingSend} send` : '—'}
                    </T>
                  </View>
                </View>
              </Row>
            );
          })}
        </Card>
      )}
    </OpsScreen>
  );
};

/** Compliance sets the address customers send an asset to on each of its networks, or closes deposits for it. */
const AssetSettings = ({ a, canEdit }: { a: AssetRow; canEdit: boolean }) => {
  const { data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const [address, setAddress] = useState(a.depositAddress ?? '');
  const others = a.networks.slice(1);
  const [extra, setExtra] = useState<Record<string, string>>(() => Object.fromEntries(others.map((n) => [n.id, n.address ?? ''])));
  const [memo, setMemo] = useState(a.depositMemo ?? '');
  const [on, setOn] = useState(a.enabled);
  return (
    <View style={{ gap: 12 }}>
      <Field>
        <Label nativeID="as-addr">{`Platform ${a.network} address`}</Label>
        <TextField
          accessibilityLabelledBy="as-addr"
          value={address}
          onChangeText={(v) => setAddress(v.trim())}
          placeholder="Not set — deposits closed"
          editable={canEdit}
          mono
          autoCapitalize="none"
          autoCorrect={false}
          height={48}
        />
      </Field>
      {others.map((n) => (
        <Field key={n.id}>
          <Label nativeID={`as-addr-${n.id}`}>{`Platform ${n.name} address`}</Label>
          <TextField
            accessibilityLabelledBy={`as-addr-${n.id}`}
            value={extra[n.id] ?? ''}
            onChangeText={(v) => setExtra((x) => ({ ...x, [n.id]: v.trim() }))}
            placeholder="Not set — this network is closed"
            editable={canEdit}
            mono
            autoCapitalize="none"
            autoCorrect={false}
            height={48}
          />
        </Field>
      ))}
      {a.memoKind === 'memo' ? (
        <Field>
          <Label nativeID="as-memo" optional>
            Fixed memo
          </Label>
          <TextField
            accessibilityLabelledBy="as-memo"
            value={memo}
            onChangeText={setMemo}
            placeholder="Blank: each customer's reference is used"
            editable={canEdit}
            mono
            autoCapitalize="none"
            height={48}
          />
        </Field>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <T size={13.5} style={{ flex: 1 }}>{`${a.id} enabled for customers`}</T>
        <Toggle label={`${a.id} enabled for customers`} on={on} onChange={setOn} disabled={!canEdit} />
      </View>
      <Help>
        {canEdit
          ? `Each address is checked against its network’s format. Every change is recorded in the audit log.`
          : 'Only Compliance can change deposit addresses.'}
      </Help>
      {canEdit ? (
        <Button
          label="Save"
          size={48}
          loading={pending}
          onPress={() =>
            void run(() =>
              data.updateAsset(
                a.id,
                address || null,
                memo || null,
                on,
                others.length ? Object.fromEntries(others.map((n) => [n.id, extra[n.id] || null])) : undefined,
              ),
            )
          }
        />
      ) : null}
    </View>
  );
};

export const AssetScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me } = useStaffSession();
  const q = useOps('assets', (d) => d.assets());
  const a = q.data?.find((x) => x.id === id);

  if (!a) {
    return (
      <OpsScreen title="Asset" backLabel="Back to assets">
        {q.data ? <Banner tone="info">This asset isn’t supported.</Banner> : <Loading error={q.error} onRetry={() => void q.refetch()} />}
      </OpsScreen>
    );
  }
  return (
    <OpsScreen title={`${a.name} · ${a.id}`} sub={a.network} backLabel="Back to assets" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CoinLogo asset={a.id} size={36} />
          <View style={{ gap: 2 }}>
            <T size={17} weight={600} num>
              {a.priceMicro ? formatAssetPrice(a.priceMicro) : '—'}
            </T>
            <T size={12.5} num color={a.changeBps >= 0 ? 'pos' : 'neg'}>
              {`${change(a.changeBps)} · 24h`}
            </T>
          </View>
        </View>
        <KV
          padX={0}
          padY={0}
          rowPad={9}
          items={[
            { k: 'Held for customers', v: `${formatAmount(a.liabilities, a.id)} · ${formatUsd(unitsToCents(a.liabilities, a.priceMicro, a.id))}` },
            {
              k: 'Deposits',
              v:
                a.depositMode === 'automatic'
                  ? 'Automatic: shared custody address + destination tag, credited by the XRPL worker'
                  : 'Reported: customers send to the address below and report the hash; staff confirm and approve',
            },
            {
              k: 'Withdrawals',
              v:
                a.depositMode === 'automatic'
                  ? 'Sent by the custody integration after approval'
                  : 'Sent by staff from the platform wallet after approval, then marked sent',
            },
          ]}
        />
        {a.pendingDeposits || a.awaitingSend ? (
          <View style={{ gap: 8 }}>
            <SecT>Waiting on staff</SecT>
            {a.pendingDeposits ? (
              <Button
                label={`${a.pendingDeposits} deposit${a.pendingDeposits === 1 ? '' : 's'} to confirm`}
                variant="secondary"
                size={48}
                onPress={() => router.push('/ops/queue')}
              />
            ) : null}
            {a.awaitingSend ? (
              <Button
                label={`${a.awaitingSend} withdrawal${a.awaitingSend === 1 ? '' : 's'} to send`}
                variant="secondary"
                size={48}
                onPress={() => router.push('/ops/transactions')}
              />
            ) : null}
          </View>
        ) : null}
        {a.depositMode === 'reported' ? (
          <View>
            <SecT>Deposit address</SecT>
            <AssetSettings key={a.id} a={a} canEdit={me.role === 'compliance'} />
          </View>
        ) : (
          <Banner tone="info" size={12.5}>
            {`Customers deposit ${a.id} to the hot custody wallet ${a.depositAddress ? shortAddr(a.depositAddress, 8, 6) : ''} with their own destination tag. Manage wallets in Custody.`}
          </Banner>
        )}
      </Panel>
    </OpsScreen>
  );
};
