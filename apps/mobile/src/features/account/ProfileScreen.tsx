import { CURRENCY_NAMES, formatAmount, shortAddress, walletNetwork } from '@xrp/ledger';
import type { ThemePreference } from '@xrp/types';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Pill } from '@/components/Badge';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/Row';
import { Screen, ScrollBody } from '@/components/Screen';
import { Sec } from '@/components/Sec';
import { Segmented } from '@/components/Segmented';
import { Select } from '@/components/Select';
import { Grab, Sheet } from '@/components/Sheet';
import { T } from '@/components/T';
import { Toggle } from '@/components/Toggle';
import { useToast } from '@/components/Toast';
import { api } from '@/data';
import { useAllowlist, useApiMutation, useConsents, useExternalWallets, useLegalDocuments, useNotificationPrefs, useProfile } from '@/data/hooks';
import { hasKey, removeSelfCustody } from '@/lib/selfCustody';
import { usePreferences } from '@/state/preferences';
import { useSession } from '@/state/session';
import { useTheme } from '@/theme';

const DOC_ORDER = ['tos', 'privacy', 'custody', 'fees', 'risk'] as const;
const CURRENCIES = Object.entries(CURRENCY_NAMES).map(([code, name]) => ({ value: code, label: `${code} · ${name}` }));

/** `.val` — 13px text-3 secondary line. */
const Val = ({ children }: { children: string }) => (
  <T size={13} color="text3">
    {children}
  </T>
);

const LinkRow = ({ first, title, val, href }: { first?: boolean; title: string; val?: string; href: Href }) => {
  const router = useRouter();
  return (
    <Row first={first} minHeight={52} accessibilityRole="link" onPress={() => router.push(href)} chevron>
      <T weight={500} style={{ flex: 1 }}>
        {title}
      </T>
      {val ? <Val>{val}</Val> : null}
    </Row>
  );
};

export const ProfileScreen = () => {
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const showToast = useToast((s) => s.show);
  const profile = useProfile();
  const allowlist = useAllowlist();
  const wallets = useExternalWallets();
  const docs = useLegalDocuments();
  const consents = useConsents();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const setSignedIn = useSession((s) => s.setSignedIn);
  const allow = useApiMutation(api.setAllowlist);
  const currency = useApiMutation(api.setDisplayCurrency);
  const remove = useApiMutation(({ address, network }: { address: string; network: string }) => api.removeExternalWallet(address, network));
  const prefs = useNotificationPrefs();
  const setPrefs = useApiMutation(api.setNotificationPrefs);
  const [connectSheet, setConnectSheet] = useState(false);
  const [signOutSheet, setSignOutSheet] = useState(false);

  const p = profile.data;
  const linked = wallets.data ?? [];
  const saved = allowlist.data?.length ?? 0;
  // Which self-custody wallets have their key on this phone (only those can send from here).
  const [keysHere, setKeysHere] = useState<string[]>([]);
  useEffect(() => {
    void Promise.all(linked.filter((w) => w.access === 'self_custody').map(async (w) => ((await hasKey(w.address)) ? w.address : null))).then((r) =>
      setKeysHere(r.filter((x): x is string => x !== null)),
    );
  }, [wallets.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = async (wallet: { address: string; access: string; network: string }) => {
    if (wallet.access === 'self_custody') await removeSelfCustody(wallet.address);
    await remove.mutateAsync({ address: wallet.address, network: wallet.network });
    showToast('Wallet disconnected. Nothing in custody was affected.', { durationMs: 2600 });
  };
  const signOut = async () => {
    await api.signOut();
    qc.clear();
    setSignOutSheet(false);
    setSignedIn(false);
    router.replace('/welcome');
  };

  return (
    <Screen>
      <ScrollBody bottom={112}>
        <T size={24} weight={600} ls={-0.02} style={{ marginTop: 8, marginHorizontal: 4, marginBottom: 16 }} accessibilityRole="header">
          Profile
        </T>
        <Card clip={false} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <T size={17} weight={600} color="accentText">
              {p?.initials ?? ''}
            </T>
          </View>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <T size={16} weight={600}>
              {p?.displayName ?? ''}
            </T>
            <T size={12.5} color="text3">
              Custodial account ·{' '}
              <T size={12.5} color="text3" mono>
                {p?.accountRef ?? ''}
              </T>
            </T>
          </View>
          {p?.kycStatus === 'verified' ? (
            <Pill height={26}>
              <Icon name="check" size="sm" color="accentText" />
              <T size={12} weight={500} color="accentText">
                Verified
              </T>
            </Pill>
          ) : (
            <Button as="a" label="Verify" size={36} variant="secondary" onPress={() => router.push('/verify')} />
          )}
        </Card>

        <Sec>Security</Sec>
        <Card>
          <Row first minHeight={52}>
            <View style={{ flex: 1, gap: 1 }}>
              <T weight={500}>Withdrawal allowlist</T>
              <Val>{p?.allowlistEnabled ? `On · ${saved} saved address${saved === 1 ? '' : 'es'}` : 'Off · any valid address'}</Val>
            </View>
            <Toggle label="Withdrawal allowlist" on={!!p?.allowlistEnabled} onChange={(v) => allow.mutate(v)} />
          </Row>
          <Row minHeight={52} accessibilityRole="link" onPress={() => router.push('/security')} chevron>
            <View style={{ flex: 1, gap: 1 }}>
              <T weight={500}>Security settings</T>
              <Val>Password, devices, allowlist</Val>
            </View>
          </Row>
        </Card>

        <Sec>External wallets</Sec>
        <Card>
          {linked.map((wallet, i) => (
            <View key={`${wallet.network}:${wallet.address}`} style={{ padding: 14, gap: 10, borderTopWidth: i === 0 ? 0 : 1, borderColor: c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: c.borderStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="link" size="sm" color="text2" />
                </View>
                <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                  <T weight={500}>{`${walletNetwork(wallet.network)?.name ?? 'XRP Ledger'} · ${wallet.access === 'watch' ? 'watch-only' : 'self-custody'}`}</T>
                  <T size={12} mono color="text3">
                    {shortAddress(wallet.address, 4, 6)}
                  </T>
                </View>
              </View>
              <View style={{ gap: 4 }}>
                {(walletNetwork(wallet.network)?.assets ?? ['XRP']).map((asset) => (
                  <View key={asset} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T size={13} color="text2">
                      {asset}
                    </T>
                    <T size={13} weight={500} num>
                      {formatAmount(wallet.balances[asset] ?? (asset === 'XRP' ? wallet.balanceDrops : 0n), asset)}
                    </T>
                  </View>
                ))}
              </View>
              <Banner tone="info" size={12.5} padding={{ v: 10, h: 12 }}>
                {wallet.access === 'watch'
                  ? 'Not held in custody. Read from the public ledger and never counted in your custodial balance.'
                  : keysHere.includes(wallet.address)
                    ? 'Keys are on this phone. We can’t recover this wallet, and it’s never counted in your custodial balance.'
                    : 'Its key is on another phone. Import it here with its recovery phrase to send from this phone.'}
              </Banner>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {keysHere.includes(wallet.address) ? (
                  <Button label="Send XRP" size={36} onPress={() => router.push({ pathname: '/wallet-send', params: { address: wallet.address } })} />
                ) : null}
                <Button label="Disconnect" variant="secondary" size={36} loading={remove.isPending} onPress={() => void disconnect(wallet)} />
              </View>
            </View>
          ))}
          <Row first={linked.length === 0} minHeight={52} onPress={() => setConnectSheet(true)} chevron>
            <View style={{ flex: 1, gap: 1 }}>
              <T weight={500}>{linked.length ? 'Connect another wallet' : 'Connect a wallet you own'}</T>
              <Val>View its balance alongside your account</Val>
            </View>
          </Row>
        </Card>

        <Sec>Preferences</Sec>
        <Card clip={false} style={{ padding: 14, gap: 10 }}>
          <T weight={500} nativeID="p-theme">
            Appearance
          </T>
          <Segmented<ThemePreference>
            label="Appearance"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
          />
          <T weight={500} style={{ marginTop: 6 }}>
            Display currency
          </T>
          <Select label="Display currency" height={48} value={p?.currency ?? 'USD'} options={CURRENCIES} onChange={(v) => currency.mutate(v)} />
        </Card>

        <Sec>Email &amp; alerts</Sec>
        <Card>
          <Row first minHeight={52}>
            <View style={{ flex: 1, gap: 1 }}>
              <T weight={500}>Transaction emails</T>
              <Val>A receipt for every deposit and withdrawal</Val>
            </View>
            <Toggle label="Transaction emails" on={prefs.data?.receipts ?? true} disabled={!prefs.data} onChange={(v) => setPrefs.mutate({ receipts: v })} />
          </Row>
          <Row minHeight={52}>
            <View style={{ flex: 1, gap: 1 }}>
              <T weight={500}>Price alerts</T>
              <Val>When an asset you hold moves more than 5% in a day</Val>
            </View>
            <Toggle label="Price alerts" on={prefs.data?.alerts ?? false} disabled={!prefs.data} onChange={(v) => setPrefs.mutate({ alerts: v })} />
          </Row>
        </Card>

        <Sec>Legal &amp; disclosures</Sec>
        <Card>
          {DOC_ORDER.map((id, i) => {
            const doc = docs.data?.find((d) => d.id === id);
            const accepted = consents.data?.find((x) => x.document === id);
            return doc ? <LinkRow key={id} first={i === 0} title={doc.name} val={`Draft ${accepted?.version ?? doc.version}`} href="/legal" /> : null;
          })}
        </Card>

        <Sec>Support</Sec>
        <Card>
          <LinkRow first title="Custody account" href="/custody" />
          <LinkRow title="Help & support" href="/support" />
          <LinkRow title="Notifications" href="/notifications" />
        </Card>
        <Button as="a" label="Sign out" variant="secondary" textColor="neg" onPress={() => setSignOutSheet(true)} style={{ marginTop: 24 }} />
        <T size={11.5} color="text3" align="center" style={{ marginTop: 16 }}>
          App v0.1 · Not affiliated with Ripple or the XRP Ledger Foundation
        </T>
      </ScrollBody>

      <Sheet
        open={connectSheet}
        onClose={() => setConnectSheet(false)}
        scrim="green"
        maxHeight={null}
        paddingX={20}
        accessibilityLabel="Connect an external wallet"
      >
        <Grab bottom={16} />
        <T size={18} weight={600} style={{ marginBottom: 10 }} accessibilityRole="header">
          Connect an external wallet
        </T>
        <T size={13.5} lh={1.5} color="text2" style={{ marginBottom: 14 }}>
          Scan its QR code or paste its address to watch its balance, or import it with its recovery phrase to send from this phone. We never hold or move its funds.
        </T>
        <Banner tone="warn" icon="shield" style={{ marginBottom: 16 }}>
          Only type a recovery phrase into this app’s import screen, on your own phone. Our staff will never ask for it; anyone who does is trying to steal your funds.
        </Banner>
        <Button
          label="Connect a wallet"
          onPress={() => {
            setConnectSheet(false);
            router.push('/connect-wallet');
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={() => setConnectSheet(false)} style={{ marginTop: 10 }} />
      </Sheet>

      <Sheet open={signOutSheet} onClose={() => setSignOutSheet(false)} scrim="green" maxHeight={null} paddingX={20} accessibilityLabel="Sign out">
        <Grab bottom={16} />
        <T size={18} weight={600} style={{ marginBottom: 10 }} accessibilityRole="header">
          Sign out of this device?
        </T>
        <T size={13.5} lh={1.5} color="text2" style={{ marginBottom: 16 }}>
          Your balances and requests aren’t affected. You’ll need your email and password to sign in again.
        </T>
        <Button label="Sign out" textColor="neg" variant="secondary" onPress={signOut} />
        <Button label="Cancel" variant="secondary" onPress={() => setSignOutSheet(false)} style={{ marginTop: 10 }} />
      </Sheet>
    </Screen>
  );
};
