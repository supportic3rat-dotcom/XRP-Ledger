import { Fragment } from 'react';
import Link from 'next/link';
import { flagCustomerAction, freezeAction } from '@/app/actions';
import { ActionButton } from '@/components/ActionButton';
import { EnvPill, PageHead } from '@/components/PageHead';
import { SearchInput } from '@/components/SearchInput';
import { ASSETS, formatAmount, formatUsd } from '@xrp/ledger';
import { RecordDepositForm } from '@/components/AssetForms';
import { CoinLogo } from '@/components/CoinLogo';
import { MASK_NOTE } from '@/lib/mask';
import { session } from '@/lib/session';

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; sel?: string }> }) {
  const sp = await searchParams;
  const { me, data } = await session();
  const all = await data.customers();
  const q = (sp.q ?? '').trim().toLowerCase();
  const list = all.filter((u) => !q || `${u.accountRef} ${u.name}`.toLowerCase().includes(q));
  const u = all.find((x) => x.accountRef === sp.sel || x.id === sp.sel) ?? all[0];
  const isComp = me.role === 'compliance';
  if (u && isComp) await data.recordViewed(u.id);
  const flagged = u?.flags.some((f) => f.startsWith('Flagged for review by you')) ?? false;
  const block = isComp ? '' : me.role === 'auditor' ? 'Read-only role: you can view but not act.' : 'Only Compliance can freeze accounts.';
  const href = (sel: string) => `/users?sel=${sel}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`;

  return (
    <>
      <PageHead title="Users" sub="Customer records. Personal data is masked according to your role." env={<EnvPill demo={data.mode === 'demo'} />} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section className="card" aria-label="Customers" style={{ flex: '999 1 520px', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <SearchInput label="Search customers" placeholder="Search by customer ID or name" />
          </div>
          <div className="q-head g4" aria-hidden="true">
            <span>Customer</span>
            <span>Verification</span>
            <span className="hide-sm">Custodial value</span>
            <span>Flags</span>
          </div>
          {list.map((x) => {
            const on = x.id === u?.id;
            return (
              <Link key={x.id} href={href(x.accountRef)} scroll={false} className={`q-row g4 btnlike ${on ? 'on' : ''}`} aria-current={on ? 'true' : undefined}>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
                    {x.accountRef}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{x.name}</span>
                </span>
                <span className={`status ${x.frozen ? 'bad' : x.kycTone}`}>{x.frozen ? 'Frozen' : x.kyc.split(' ·')[0]}</span>
                <span className="num hide-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {formatUsd(x.totalUsdCents)}
                  <span style={{ display: 'inline-flex', gap: 2 }}>
                    {x.holdings.slice(0, 3).map((h) => (
                      <CoinLogo key={h.asset} asset={h.asset} size={14} />
                    ))}
                  </span>
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{x.flags.length ? `${x.flags.length} open` : '—'}</span>
              </Link>
            );
          })}
          {list.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>No customers match.</div>
          ) : null}
        </section>
        {u ? (
          <section
            className="card"
            aria-labelledby="u-title"
            style={{ flex: '1 1 400px', minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  {u.accountRef} · joined {u.joined}
                </span>
                <span className={`status ${u.frozen ? 'bad' : 'ok'}`}>{u.frozen ? 'Frozen' : 'Active'}</span>
              </div>
              <h2 id="u-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                {u.name}
              </h2>
            </div>
            <div className="banner info">{MASK_NOTE[me.role]}</div>
            <div>
              <h3 className="sec-t">Personal details</h3>
              <dl className="kv">
                <dt>Email</dt>
                <dd>{u.email}</dd>
                <dt>Phone</dt>
                <dd className="num">{u.phone}</dd>
                <dt>Date of birth</dt>
                <dd className="num">{u.dob}</dd>
                <dt>Country</dt>
                <dd>{u.country}</dd>
                <dt>Verification</dt>
                <dd>{u.kyc} · [KYC provider]</dd>
                <dt>Risk rating</dt>
                <dd>{u.risk}</dd>
              </dl>
            </div>
            <div>
              <h3 className="sec-t">{`Holdings · ${formatUsd(u.totalUsdCents)}`}</h3>
              {u.holdings.length ? (
                <div role="table" aria-label="Holdings by asset" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    role="row"
                    style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 0.9fr', gap: 8, fontSize: 12, color: 'var(--text-3)', paddingBottom: 6 }}
                  >
                    <span role="columnheader">Asset</span>
                    <span role="columnheader" style={{ textAlign: 'right' }}>
                      Available
                    </span>
                    <span role="columnheader" style={{ textAlign: 'right' }}>
                      Yield
                    </span>
                    <span role="columnheader" style={{ textAlign: 'right' }}>
                      Collateral
                    </span>
                    <span role="columnheader" style={{ textAlign: 'right' }}>
                      Value
                    </span>
                  </div>
                  {u.holdings.map((h) => (
                    <div
                      key={h.asset}
                      role="row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1fr 1fr 1fr 0.9fr',
                        gap: 8,
                        alignItems: 'center',
                        fontSize: 13,
                        padding: '7px 0',
                        borderTop: '1px solid var(--row-divider)',
                      }}
                    >
                      <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                        <CoinLogo asset={h.asset} />
                        {h.asset}
                      </span>
                      <span role="cell" className="num" style={{ textAlign: 'right' }}>
                        {formatAmount(h.available + h.reserved, h.asset).replace(` ${h.asset}`, '')}
                      </span>
                      <span role="cell" className="num" style={{ textAlign: 'right', color: h.yield ? undefined : 'var(--text-3)' }}>
                        {h.yield ? formatAmount(h.yield, h.asset).replace(` ${h.asset}`, '') : '—'}
                      </span>
                      <span role="cell" className="num" style={{ textAlign: 'right', color: h.collateral ? undefined : 'var(--text-3)' }}>
                        {h.collateral ? formatAmount(h.collateral, h.asset).replace(` ${h.asset}`, '') : '—'}
                      </span>
                      <span role="cell" className="num" style={{ textAlign: 'right', fontWeight: 500 }}>
                        {formatUsd(h.valueCents)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="chk">
                  <span style={{ flex: '1 1 0%', color: 'var(--text-3)' }}>No balances yet</span>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <RecordDepositForm
                  key={u.id}
                  customerId={u.id}
                  assets={ASSETS.filter((x) => x.deposit === 'reported').map((x) => ({ id: x.id, name: x.name }))}
                  disabled={me.role === 'auditor'}
                />
              </div>
            </div>
            <div>
              <h3 className="sec-t">Devices and sign-ins</h3>
              {u.devices.length ? (
                <dl className="kv">
                  {u.devices.map((d) => (
                    <Fragment key={d.name}>
                      <dt>{d.name}</dt>
                      <dd>{`${d.location} · ${d.revoked ? 'signed out' : d.lastActive}`}</dd>
                    </Fragment>
                  ))}
                </dl>
              ) : (
                <div className="chk">
                  <span style={{ flex: '1 1 0%', color: 'var(--text-3)' }}>No devices recorded</span>
                </div>
              )}
            </div>
            <div>
              <h3 className="sec-t">Recent activity</h3>
              {u.activity.length ? (
                <dl className="kv">
                  {u.activity.map((a) => (
                    <Fragment key={a.title + a.at}>
                      <dt>{a.title}</dt>
                      <dd className="num">{`${a.meta} · ${a.at}`}</dd>
                    </Fragment>
                  ))}
                </dl>
              ) : (
                <div className="chk">
                  <span style={{ flex: '1 1 0%', color: 'var(--text-3)' }}>No activity recorded</span>
                </div>
              )}
            </div>
            <div>
              <h3 className="sec-t">Flags</h3>
              {u.flags.length ? (
                u.flags.map((f) => (
                  <div key={f} className="chk">
                    <span style={{ flex: '1 1 0%' }}>{f}</span>
                  </div>
                ))
              ) : (
                <div className="chk">
                  <span style={{ flex: '1 1 0%', color: 'var(--text-3)' }}>No open flags</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--row-divider)' }}>
              <Link href={u.latestTxId ? `/transactions?filter=all&sel=${u.latestTxId}` : '/transactions'} className="btn btn-secondary btnlike">
                View transactions
              </Link>
              <ActionButton action={flagCustomerAction.bind(null, u.id)} className="btn btn-secondary" disabled={me.role === 'auditor' || flagged}>
                Flag for review
              </ActionButton>
              <ActionButton action={freezeAction.bind(null, u.id, !u.frozen)} className="btn btn-danger" disabled={!isComp}>
                {u.frozen ? 'Unfreeze account' : 'Freeze account'}
              </ActionButton>
            </div>
            {block ? <span style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right', marginTop: -10 }}>{block}</span> : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
