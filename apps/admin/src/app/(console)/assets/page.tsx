import { formatAmount, formatAssetPrice, formatUsd, unitsToCents } from '@xrp/ledger';
import Link from 'next/link';
import { AssetSettings } from '@/components/AssetForms';
import { CoinLogo } from '@/components/CoinLogo';
import { EnvPill, PageHead } from '@/components/PageHead';
import { shortAddr } from '@/lib/format';
import { session } from '@/lib/session';

/**
 * Supported assets: live price, what the platform holds for customers, deposits waiting for confirmation,
 * withdrawals waiting to be sent, and (Compliance) where customers send each asset.
 */
export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ sel?: string }> }) {
  const sp = await searchParams;
  const { me, data } = await session();
  const assets = await data.assets();
  const a = assets.find((x) => x.id === sp.sel) ?? assets[0];
  const totalCents = assets.reduce((s, x) => s + unitsToCents(x.liabilities, x.priceMicro, x.id), 0n);
  const waiting = assets.reduce((s, x) => s + x.pendingDeposits + x.awaitingSend, 0);

  return (
    <>
      <PageHead
        title="Assets"
        sub={`${assets.length} supported assets · ${formatUsd(totalCents)} held for customers · ${waiting} items waiting on staff`}
        env={<EnvPill demo={data.mode === 'demo'} />}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section className="card" aria-label="Assets" style={{ flex: '999 1 560px', minWidth: 0, overflow: 'hidden' }}>
          <div className="q-head g5" aria-hidden="true">
            <span>Asset</span>
            <span>Price · 24h</span>
            <span className="hide-sm">Held for customers</span>
            <span className="hide-sm">Deposits</span>
            <span>Waiting</span>
          </div>
          {assets.map((x) => {
            const on = x.id === a?.id;
            const up = x.changeBps >= 0;
            const open = x.depositMode === 'automatic' || !!x.depositAddress;
            return (
              <Link key={x.id} href={`/assets?sel=${x.id}`} scroll={false} className={`q-row g5 btnlike ${on ? 'on' : ''}`} aria-current={on ? 'true' : undefined}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <CoinLogo asset={x.id} size={24} />
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 500 }}>{x.id}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.network}</span>
                  </span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="num">{x.priceMicro ? formatAssetPrice(x.priceMicro) : '—'}</span>
                  <span className="num" style={{ fontSize: 12, color: up ? 'var(--pos)' : 'var(--neg)' }}>
                    {`${up ? '+' : '−'}${Math.abs(x.changeBps / 100).toFixed(2)}%`}
                  </span>
                </span>
                <span className="num hide-sm" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{formatAmount(x.liabilities, x.id)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{formatUsd(unitsToCents(x.liabilities, x.priceMicro, x.id))}</span>
                </span>
                <span className={`status hide-sm ${!x.enabled ? 'off' : open ? 'ok' : 'wait'}`}>
                  {!x.enabled ? 'Disabled' : x.depositMode === 'automatic' ? 'Automatic' : open ? 'Open' : 'No address'}
                </span>
                <span style={{ fontSize: 12.5, color: x.pendingDeposits + x.awaitingSend ? undefined : 'var(--text-3)' }}>
                  {x.pendingDeposits + x.awaitingSend ? `${x.pendingDeposits} dep · ${x.awaitingSend} send` : '—'}
                </span>
              </Link>
            );
          })}
        </section>
        {a ? (
          <section
            className="card"
            aria-labelledby="asset-title"
            style={{ flex: '1 1 360px', minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CoinLogo asset={a.id} size={36} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h2 id="asset-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  {a.name} · {a.id}
                </h2>
                <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{a.network}</span>
              </div>
            </div>
            <dl className="kv">
              <dt>Price</dt>
              <dd className="num">{a.priceMicro ? formatAssetPrice(a.priceMicro) : '—'}</dd>
              <dt>Held for customers</dt>
              <dd className="num">{`${formatAmount(a.liabilities, a.id)} · ${formatUsd(unitsToCents(a.liabilities, a.priceMicro, a.id))}`}</dd>
              <dt>Deposits</dt>
              <dd>
                {a.depositMode === 'automatic'
                  ? 'Automatic: shared custody address + destination tag, credited by the XRPL worker'
                  : 'Reported: customers send to the address below and report the hash; staff confirm and approve'}
              </dd>
              <dt>Withdrawals</dt>
              <dd>{a.depositMode === 'automatic' ? 'Sent by the custody integration after approval' : 'Sent by staff from the platform wallet after approval, then marked sent'}</dd>
              <dt>Waiting on staff</dt>
              <dd>
                {a.pendingDeposits || a.awaitingSend ? (
                  <>
                    {a.pendingDeposits ? <Link href="/queue?filter=deposit">{`${a.pendingDeposits} deposit${a.pendingDeposits === 1 ? '' : 's'} to confirm`}</Link> : null}
                    {a.pendingDeposits && a.awaitingSend ? ' · ' : null}
                    {a.awaitingSend ? <Link href="/transactions?filter=withdrawal">{`${a.awaitingSend} withdrawal${a.awaitingSend === 1 ? '' : 's'} to send`}</Link> : null}
                  </>
                ) : (
                  'Nothing'
                )}
              </dd>
            </dl>
            {a.depositMode === 'reported' ? (
              <div>
                <h3 className="sec-t">Deposit address</h3>
                <AssetSettings
                  key={a.id}
                  asset={a.id}
                  network={a.network}
                  address={a.depositAddress}
                  memo={a.depositMemo}
                  memoKind={a.memoKind}
                  enabled={a.enabled}
                  canEdit={me.role === 'compliance'}
                />
              </div>
            ) : (
              <div className="banner info">{`Customers deposit ${a.id} to the hot custody wallet ${a.depositAddress ? shortAddr(a.depositAddress, 8, 6) : ''} with their own destination tag. Manage wallets in Custody.`}</div>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
