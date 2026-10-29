import { ASSETS, countryByCode, formatAmount, formatUsd, parseUnits, walletNetwork } from '@xrp/ledger';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CoinLogo } from '@/components/CoinLogo';
import { Field, Help, Label, TextField } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { KV } from '@/components/KV';
import { Row } from '@/components/Row';
import { Select } from '@/components/Select';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { SUPPORT_EMAIL } from '@/lib/support';
import { useTheme } from '@/theme';
import { MASK_NOTE } from '../data/mask';
import type { IdentityCheck, IdentityDecision } from '../data/types';
import { useOps, useOpsAction, useStaffSession } from '../hooks';
import { BlockNote, Empty, Line, Loading, OpsScreen, Panel, SecT } from '../ui';

export const UsersScreen = () => {
  const router = useRouter();
  const { c } = useTheme();
  const q = useOps('customers', (d) => d.customers());
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const list = (q.data ?? []).filter((u) => !needle || `${u.accountRef} ${u.name}`.toLowerCase().includes(needle));

  return (
    <OpsScreen tab title="Users" sub="Customer records. Personal data is masked according to your role." refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <TextField
        accessibilityLabel="Search customers"
        placeholder="Search by customer ID or name"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        height={48}
        leading={<Icon name="search" size="sm" color="text3" />}
      />
      {!q.data ? (
        <Loading error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card>
          {list.map((x, i) => (
            <Row key={x.id} first={i === 0} chevron onPress={() => router.push(`/ops/customer/${x.id}`)} accessibilityLabel={`${x.accountRef}, ${x.name}`}>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T size={12.5} mono weight={500}>
                    {x.accountRef}
                  </T>
                  <Status tone={x.frozen ? 'bad' : x.kycTone} label={x.frozen ? 'Frozen' : (x.kyc.split(' ·')[0] ?? x.kyc)} />
                </View>
                <T size={13} color="text2" numberOfLines={1}>
                  {x.name}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T size={12.5} num>
                      {formatUsd(x.totalUsdCents)}
                    </T>
                    {x.holdings.slice(0, 3).map((h) => (
                      <CoinLogo key={h.asset} asset={h.asset} size={14} />
                    ))}
                  </View>
                  <T size={12} rawColor={x.flags.length ? c.warn : c.text3}>
                    {x.flags.length ? `${x.flags.length} flag${x.flags.length === 1 ? '' : 's'} open` : 'No flags'}
                  </T>
                </View>
              </View>
            </Row>
          ))}
          {list.length === 0 ? <Empty>No customers match.</Empty> : null}
        </Card>
      )}
    </OpsScreen>
  );
};

const REPORTED_ASSETS = ASSETS.filter((x) => x.deposit === 'reported').map((x) => ({ value: x.id, label: `${x.id} · ${x.name}` }));

/** Record a deposit seen arriving on the network for this customer. Another staff member approves the credit. */
const DOC_NAMES: Record<string, string> = { 'id-photo': 'Passport photo page', 'id-front': 'ID front', 'id-back': 'ID back', selfie: 'Selfie' };
const docName = (file: string) => DOC_NAMES[file] ?? (file.startsWith('address-') ? 'Proof of address' : file);
const DOC_TYPES: Record<string, string> = { passport: 'Passport', national: 'National ID card', licence: 'Driver’s licence' };
const IDENTITY_STATUS: Record<IdentityCheck['status'], { label: string; tone: 'ok' | 'wait' | 'bad' | 'off' }> = {
  in_progress: { label: 'Waiting for review', tone: 'wait' },
  more_info: { label: 'More info requested', tone: 'wait' },
  verified: { label: 'Verified', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'bad' },
  restricted: { label: 'Restricted', tone: 'bad' },
  not_started: { label: 'Not started', tone: 'off' },
};

/**
 * The customer's latest identity check. Compliance sees the uploaded documents (links signed for 5 minutes) and
 * verifies, asks for more, or rejects; the decision is audited and the customer is notified.
 */
const IdentityPanel = ({ customerId }: { customerId: string }) => {
  const { data, me } = useStaffSession();
  const { c } = useTheme();
  const { pending, run } = useOpsAction();
  const q = useOps(`identity:${customerId}`, (d) => d.identity(customerId));
  const [mode, setMode] = useState<Exclude<IdentityDecision, 'verified'> | null>(null);
  const [note, setNote] = useState('');
  const k = q.data;
  const isComp = me.role === 'compliance';
  if (!q.data && q.isLoading) return <Loading error={q.error} onRetry={() => void q.refetch()} />;
  if (!k) {
    return (
      <T size={13} color="text3">
        No documents submitted yet.
      </T>
    );
  }
  const st = IDENTITY_STATUS[k.status];
  const decide = (decision: IdentityDecision) =>
    void run(
      () => data.decideIdentity(customerId, decision, note.trim()),
      () => {
        setMode(null);
        setNote('');
      },
    );
  return (
    <View style={{ gap: 12 }}>
      <KV
        padX={0}
        padY={0}
        rowPad={9}
        items={[
          { k: 'Status', v: st.label },
          { k: 'Document', v: `${DOC_TYPES[k.documentType ?? ''] ?? k.documentType ?? '—'}${k.country ? ` · ${k.country}` : ''}` },
          { k: 'Submitted', v: new Date(k.submittedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) },
        ]}
      />
      {isComp ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {k.documents.map((d) => (
            <Pressable
              key={d.name}
              accessibilityRole={d.url ? 'link' : undefined}
              accessibilityLabel={`${docName(d.name)}${d.url ? '. Open full size' : ''}`}
              disabled={!d.url}
              onPress={() => d.url && void Linking.openURL(d.url)}
              style={{ width: '31%', gap: 6 }}
            >
              <View style={{ aspectRatio: 0.75, borderRadius: 10, overflow: 'hidden', backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' }}>
                {d.url ? <Image source={{ uri: d.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Icon name="file" color="text3" />}
              </View>
              <T size={11.5} color="text2" numberOfLines={2}>
                {docName(d.name)}
              </T>
            </Pressable>
          ))}
        </View>
      ) : (
        <Help>Only Compliance can see identity documents.</Help>
      )}
      {isComp && k.status === 'in_progress' ? (
        mode ? (
          <Card style={{ padding: 14, gap: 12 }}>
            <Field>
              <Label nativeID="id-note">{mode === 'rejected' ? 'Why is it rejected?' : 'What does the customer need to send?'}</Label>
              <TextField
                accessibilityLabelledBy="id-note"
                value={note}
                onChangeText={setNote}
                placeholder={mode === 'rejected' ? 'e.g. The document has expired.' : 'e.g. The photo is blurred; upload a clearer one.'}
                height={48}
              />
              <Help>The customer sees this, and it goes into the audit log.</Help>
            </Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Cancel" variant="secondary" size={48} flex={1} onPress={() => setMode(null)} />
              <Button
                label={mode === 'rejected' ? 'Reject' : 'Ask for more'}
                textColor={mode === 'rejected' ? 'neg' : undefined}
                variant="secondary"
                size={48}
                flex={1}
                loading={pending}
                onPress={() => decide(mode)}
              />
            </View>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            <Button label="Verify identity" size={48} loading={pending} onPress={() => decide('verified')} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Ask for more" variant="secondary" size={48} flex={1} onPress={() => setMode('more_info')} />
              <Button label="Reject" variant="secondary" textColor="neg" size={48} flex={1} onPress={() => setMode('rejected')} />
            </View>
            <Help>Check the photo matches the selfie, the name and date of birth match the account, and the document is valid.</Help>
          </View>
        )
      ) : null}
    </View>
  );
};

/**
 * Password reset by support: the customer emails support.xrpledger@gmail.com, and Compliance sets a new password
 * here and emails it back to the address on the account. Every session is signed out and withdrawals pause for 24 hours.
 */
const PasswordReset = ({ customerId, email }: { customerId: string; email: string }) => {
  const { data, me } = useStaffSession();
  const { c } = useTheme();
  const { pending, run } = useOpsAction();
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  if (me.role !== 'compliance') return <Help>Only Compliance can reset a customer’s password.</Help>;
  if (issued) {
    const mail = `mailto:${issued.email}?subject=${encodeURIComponent('Your new password')}&body=${encodeURIComponent(
      `Hello,\n\nAs you asked, we've reset your password. Your new password is:\n\n${issued.password}\n\nSign in with it, then choose your own password in Profile → Security. Withdrawals are paused for 24 hours after a reset.\n\nIf you didn't ask for this, reply to this email straight away.\n\nSupport team`,
    )}`;
    return (
      <View style={{ gap: 10 }}>
        <Banner tone="warn" size={12.5}>
          {`New password set. It’s shown only once: email it to ${issued.email} now.`}
        </Banner>
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.sunken, paddingVertical: 12, paddingHorizontal: 14 }}>
          <T size={15} mono weight={500} selectable accessibilityLabel={`New password ${issued.password.split('').join(' ')}`}>
            {issued.password}
          </T>
        </View>
        <Button label="Email it to the customer" size={48} onPress={() => void Linking.openURL(mail)} />
        <Button
          label="Copy password"
          variant="secondary"
          size={48}
          onPress={async () => {
            const { setStringAsync } = await import('expo-clipboard');
            await setStringAsync(issued.password).catch(() => undefined);
          }}
        />
        <Button label="Done" variant="secondary" size={48} onPress={() => setIssued(null)} />
      </View>
    );
  }
  if (!confirming) {
    return (
      <View style={{ gap: 8 }}>
        <Button label="Set a new password" variant="secondary" size={48} onPress={() => setConfirming(true)} />
        <Help>{`For customers who emailed ${SUPPORT_EMAIL} asking for a password reset.`}</Help>
      </View>
    );
  }
  return (
    <Card style={{ padding: 14, gap: 12 }}>
      <T size={13} lh={1.5}>
        {`Only reset if the request came from ${email}, the email on this account. Every session is signed out and withdrawals pause for 24 hours.`}
      </T>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Cancel" variant="secondary" size={48} flex={1} onPress={() => setConfirming(false)} />
        <Button
          label="Set new password"
          size={48}
          flex={1}
          loading={pending}
          onPress={() =>
            void run(async () => {
              const r = await data.resetPassword(customerId);
              if (!r.ok) return r;
              setConfirming(false);
              setIssued({ email: r.email, password: r.password });
              return { ok: true };
            })
          }
        />
      </View>
    </Card>
  );
};

const TRUST_NAMES: Record<string, string> = { revocable: 'Revocable trust', irrevocable: 'Irrevocable trust', spendthrift: 'Spendthrift trust' };
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** Address, crypto trust, beneficiaries and linked wallets — everything the customer gave us, masked by role. */
const ProfileExtras = ({ customerId }: { customerId: string }) => {
  const q = useOps(`extras:${customerId}`, (d) => d.customerExtras(customerId));
  const x = q.data;
  if (!x) return <Loading error={q.error} onRetry={() => void q.refetch()} />;
  const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const country = countryByCode(x.address.country)?.name ?? x.address.country;
  return (
    <>
      <View>
        <SecT>Address</SecT>
        <KV
          padX={0}
          padY={0}
          rowPad={9}
          items={[
            ...(x.address.line !== undefined ? [{ k: 'Street', v: x.address.line ?? '—' }] : []),
            ...(x.address.city !== undefined ? [{ k: 'City', v: x.address.city ?? '—' }] : []),
            ...(x.address.region !== undefined ? [{ k: 'State / region', v: x.address.region ?? '—' }] : []),
            ...(x.address.postalCode !== undefined ? [{ k: 'Postal code', v: x.address.postalCode ?? '—' }] : []),
            { k: 'Country', v: country || '—' },
          ]}
        />
      </View>
      <View>
        <SecT>Crypto trust</SecT>
        {x.trust ? (
          <KV
            padX={0}
            padY={0}
            rowPad={9}
            items={[
              { k: 'Type', v: TRUST_NAMES[x.trust.type] ?? cap(x.trust.type) },
              { k: 'Reference', v: x.trust.ref, mono: true },
              { k: 'Status', v: cap(x.trust.status) },
              { k: 'Created', v: when(x.trust.createdAt) },
              { k: 'Terms agreed', v: when(x.trust.termsAgreedAt) },
            ]}
          />
        ) : (
          <T size={13} color="text3">
            No trust yet. The customer is asked to create one at sign-in.
          </T>
        )}
      </View>
      {x.beneficiaries.length ? (
        <View>
          <SecT>{`Beneficiaries · ${x.beneficiaries.reduce((n, b) => n + b.allocationPct, 0)}%`}</SecT>
          {x.beneficiaries.map((b, i) => (
            <Line key={i} first={i === 0} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <T size={13.5} weight={500}>{b.isSelf ? `${b.name} (the customer)` : b.name}</T>
                <T size={12} color="text3">
                  {[cap(b.relationship), b.email].filter(Boolean).join(' · ')}
                </T>
                {b.wallet ? (
                  <T size={12} mono color="text3" numberOfLines={1}>
                    {b.wallet}
                  </T>
                ) : null}
              </View>
              <T size={13.5} weight={600} num>{`${b.allocationPct}%`}</T>
            </Line>
          ))}
        </View>
      ) : null}
      <View>
        <SecT>Linked wallets</SecT>
        {x.wallets.length ? (
          x.wallets.map((w, i) => (
            <Line key={`${w.network}:${w.address}`} first={i === 0} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <T size={13.5} weight={500}>{`${walletNetwork(w.network)?.name ?? w.network} · ${w.access === 'watch' ? 'watch-only' : 'self-custody'}`}</T>
                <T size={12} mono color="text3" numberOfLines={1}>
                  {w.address}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {Object.entries(w.balances).map(([asset, units]) => (
                  <T key={asset} size={12.5} num>
                    {formatAmount(BigInt(units), asset)}
                  </T>
                ))}
              </View>
            </Line>
          ))
        ) : (
          <T size={13} color="text3">
            None
          </T>
        )}
      </View>
    </>
  );
};

const RecordDeposit = ({ customerId, disabled }: { customerId: string; disabled: boolean }) => {
  const { data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState(REPORTED_ASSETS[0]?.value ?? 'BTC');
  const [amount, setAmount] = useState('');
  const [hash, setHash] = useState('');
  const [note, setNote] = useState('');
  if (!open) return <Button label="Record a deposit" variant="secondary" size={48} disabled={disabled} onPress={() => setOpen(true)} />;
  const submit = () => {
    const units = parseUnits(amount, asset);
    if (units === null || units <= 0n) {
      void run(async () => ({ ok: false, error: `Enter a valid ${asset} amount.` }));
      return;
    }
    if (hash.trim().length < 8) {
      void run(async () => ({ ok: false, error: 'Enter the amount and the network transaction hash.' }));
      return;
    }
    void run(
      () => data.recordDeposit(customerId, asset, units, hash.trim(), note.trim()),
      () => {
        setOpen(false);
        setAmount('');
        setHash('');
        setNote('');
      },
    );
  };
  return (
    <Card style={{ padding: 14, gap: 12 }}>
      <SecT>Record a deposit</SecT>
      <T size={12.5} lh={1.45} color="text3" style={{ marginTop: -8 }}>
        For coins that arrived at a platform address. It goes to the approval queue; a different staff member confirms it on the network and approves the credit.
      </T>
      <Field>
        <Label>Asset</Label>
        <Select label="Asset" value={asset} options={REPORTED_ASSETS} onChange={(v) => setAsset(v as typeof asset)} height={48} />
      </Field>
      <Field>
        <Label nativeID="rd-amt">Amount received</Label>
        <TextField accessibilityLabelledBy="rd-amt" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} placeholder="0.00" keyboardType="decimal-pad" num height={48} />
      </Field>
      <Field>
        <Label nativeID="rd-hash">Network transaction hash</Label>
        <TextField accessibilityLabelledBy="rd-hash" value={hash} onChangeText={(v) => setHash(v.trim())} placeholder="Paste from the block explorer" mono autoCapitalize="none" autoCorrect={false} height={48} />
      </Field>
      <Field>
        <Label nativeID="rd-note" optional>
          Note
        </Label>
        <TextField accessibilityLabelledBy="rd-note" value={note} onChangeText={setNote} placeholder="e.g. matched by memo, customer ticket SUP-…" height={48} />
      </Field>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Cancel" variant="secondary" size={48} flex={1} onPress={() => setOpen(false)} />
        <Button label="Send for approval" size={48} flex={1} loading={pending} onPress={submit} />
      </View>
    </Card>
  );
};

export const CustomerScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me, data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const q = useOps('customers', (d) => d.customers());
  const u = q.data?.find((x) => x.id === id || x.accountRef === id);
  const isComp = me.role === 'compliance';
  const uid = u?.id;

  // Compliance opening a full record is itself audited.
  useEffect(() => {
    if (uid && isComp) void data.recordViewed(uid);
  }, [uid, isComp, data]);

  if (!u) {
    return (
      <OpsScreen title="Customer" backLabel="Back to users">
        {q.data ? <Banner tone="info">This customer couldn’t be found.</Banner> : <Loading error={q.error} onRetry={() => void q.refetch()} />}
      </OpsScreen>
    );
  }
  const flagged = u.flags.some((f) => f.startsWith('Flagged for review by you'));
  const block = isComp ? '' : me.role === 'auditor' ? 'Read-only role: you can view but not act.' : 'Only Compliance can freeze accounts.';
  const amt = (units: bigint, asset: string) => formatAmount(units, asset).replace(` ${asset}`, '');

  return (
    <OpsScreen title={u.name} backLabel="Back to users" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <T size={12.5} mono color="text3" style={{ flexShrink: 1 }}>
            {`${u.accountRef} · joined ${u.joined}`}
          </T>
          <Status tone={u.frozen ? 'bad' : 'ok'} label={u.frozen ? 'Frozen' : 'Active'} />
        </View>
        <Banner tone="info" size={12.5}>
          {MASK_NOTE[me.role]}
        </Banner>

        <View>
          <SecT>Personal details</SecT>
          <KV
            padX={0}
            padY={0}
            rowPad={9}
            items={[
              { k: 'Email', v: u.email },
              { k: 'Phone', v: u.phone },
              { k: 'Date of birth', v: u.dob },
              { k: 'Country', v: u.country },
              { k: 'Verification', v: u.kyc },
              { k: 'Risk rating', v: u.risk },
            ]}
          />
        </View>

        <ProfileExtras customerId={u.id} />

        <View>
          <SecT>Identity check</SecT>
          <IdentityPanel customerId={u.id} />
        </View>

        <View>
          <SecT>Password</SecT>
          <PasswordReset customerId={u.id} email={u.email} />
        </View>

        <View>
          <SecT>{`Holdings · ${formatUsd(u.totalUsdCents)}`}</SecT>
          {u.holdings.length ? (
            u.holdings.map((h, i) => (
              <Line key={h.asset} first={i === 0} style={{ alignItems: 'flex-start' }}>
                <CoinLogo asset={h.asset} size={24} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T size={13.5} weight={500}>
                      {h.asset}
                    </T>
                    <T size={13.5} num weight={500}>
                      {formatUsd(h.valueCents)}
                    </T>
                  </View>
                  <T size={12} num color="text3">
                    {`Available ${amt(h.available + h.reserved, h.asset)}${h.yield ? ` · Yield ${amt(h.yield, h.asset)}` : ''}${h.collateral ? ` · Collateral ${amt(h.collateral, h.asset)}` : ''}`}
                  </T>
                </View>
              </Line>
            ))
          ) : (
            <T size={13} color="text3">
              No balances yet
            </T>
          )}
          <View style={{ marginTop: 12 }}>
            <RecordDeposit key={u.id} customerId={u.id} disabled={me.role === 'auditor'} />
          </View>
        </View>

        <View>
          <SecT>Devices and sign-ins</SecT>
          {u.devices.length ? (
            <KV padX={0} padY={0} rowPad={9} items={u.devices.map((d) => ({ k: d.name, v: `${d.location} · ${d.revoked ? 'signed out' : d.lastActive}` }))} />
          ) : (
            <T size={13} color="text3">
              No devices recorded
            </T>
          )}
        </View>

        <View>
          <SecT>Recent activity</SecT>
          {u.activity.length ? (
            <KV padX={0} padY={0} rowPad={9} items={u.activity.map((a) => ({ k: a.title, v: `${a.meta} · ${a.at}` }))} />
          ) : (
            <T size={13} color="text3">
              No activity recorded
            </T>
          )}
        </View>

        <View>
          <SecT>Flags</SecT>
          {u.flags.length ? (
            u.flags.map((f, i) => (
              <Line key={f} first={i === 0}>
                <T size={13} style={{ flex: 1 }}>
                  {f}
                </T>
              </Line>
            ))
          ) : (
            <T size={13} color="text3">
              No open flags
            </T>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <Button
            label="View transactions"
            variant="secondary"
            size={48}
            onPress={() => router.push(u.latestTxId ? `/ops/tx/${u.latestTxId}` : '/ops/transactions')}
          />
          <Button label="Flag for review" variant="secondary" size={48} disabled={me.role === 'auditor' || flagged || pending} onPress={() => void run(() => data.flagCustomer(u.id))} />
          <Button
            label={u.frozen ? 'Unfreeze account' : 'Freeze account'}
            variant="secondary"
            textColor="neg"
            size={48}
            disabled={!isComp || pending}
            onPress={() => void run(() => data.setFrozen(u.id, !u.frozen))}
          />
          <BlockNote>{block}</BlockNote>
        </View>
      </Panel>
    </OpsScreen>
  );
};
