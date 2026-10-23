import Link from 'next/link';
import { bookFeeAction, contactProviderAction, runReconAction } from '@/app/actions';
import { ActionButton } from '@/components/ActionButton';
import { EnvPill, PageHead } from '@/components/PageHead';
import type { ReconWalletRow } from '@/lib/data/types';
import { xrp2, xrp6, xrpAuto, xrpDiff } from '@/lib/format';
import { session } from '@/lib/session';

/** Hot wallet rows show 6 decimals (fees land there); warm/cold 2; totals 2 unless sub-cent. */
const cell = (w: ReconWalletRow, v: bigint) => (w.tier === 'hot' ? xrp6(v) : w.tier === 'total' ? xrpAuto(v) : xrp2(v));

export default async function ReconciliationPage() {
  const { me, data } = await session();
  const r = await data.recon();
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
      <PageHead
        title="Reconciliation"
        sub="Internal ledger, custody provider and XRP Ledger must agree. Differences become exceptions."
        env={<EnvPill demo={data.mode === 'demo'} />}
      />
      <section className="card" style={{ padding: '16px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 600 }}>
            <span className="mono">{r.runRef.replace(/-0+(\d)/, '-$1')}</span> · {r.when}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            Internal ledger vs [Custody provider] vs XRP Ledger (validated ledger {r.validatedLedger.toLocaleString('en-US')})
          </span>
        </div>
        <span className={`status ${open.length ? 'wait' : 'ok'}`}>
          {open.length ? `${open.length} exception${open.length > 1 ? 's' : ''} open` : 'Balanced'}
        </span>
        <ActionButton action={runReconAction} className="btn btn-secondary" disabled={me.role === 'auditor'}>
          Run now
        </ActionButton>
      </section>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section className="card" aria-label="Wallet balances" style={{ flex: '999 1 560px', minWidth: 0, padding: 18, overflowX: 'auto' }}>
          <h3 className="sec-t">Holdings by wallet · XRP</h3>
          <table className="jl">
            <thead>
              <tr>
                <th>Wallet</th>
                <th className="r">Internal ledger</th>
                <th className="r">Custody provider</th>
                <th className="r">On ledger</th>
                <th className="r">Difference</th>
              </tr>
            </thead>
            <tbody>
              {r.wallets.map((w) => {
                const diff = w.chain - w.internal;
                return (
                  <tr key={w.name} className={w.tier === 'total' ? 'total' : ''}>
                    <td>{w.name}</td>
                    <td className="r">{cell(w, w.internal)}</td>
                    <td className="r">{cell(w, w.provider)}</td>
                    <td className="r">{cell(w, w.chain)}</td>
                    <td className="r" style={{ color: diff === 0n ? 'var(--pos)' : 'var(--neg)', fontWeight: 500 }}>
                      {xrpDiff(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h3 className="sec-t" style={{ marginTop: 20 }}>
            Liabilities · XRP
          </h3>
          <dl className="kv">
            <dt>Customer balances (available, reserved, yield, collateral)</dt>
            <dd className="num">{xrp2(r.customerLiabilitiesDrops)}</dd>
            <dt>Unattributed deposits (suspense)</dt>
            <dd className="num">{xrp2(r.suspenseDrops)}</dd>
            <dt>Total liabilities</dt>
            <dd className="num">{xrp2(liabilities)}</dd>
            <dt>Holdings ÷ liabilities</dt>
            <dd className="num" style={{ color: ratio >= 100 ? 'var(--pos)' : 'var(--neg)' }}>
              {ratio.toFixed(2)}%
            </dd>
          </dl>
        </section>
        <section className="card" aria-label="Exceptions" style={{ flex: '1 1 380px', minWidth: 0, padding: 18 }}>
          <h3 className="sec-t">Exceptions · {open.length} open</h3>
          {r.exceptions.map((e) => {
            const done = e.status === 'resolved';
            const status = e.statusNote ?? (e.status === 'open' ? 'Open' : e.status === 'investigating' ? 'Investigating' : 'Resolved');
            const contacted = e.statusNote?.includes('contacted');
            return (
              <div key={e.id} className="chk" style={{ flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 500 }}>{e.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{e.note}</span>
                  <span className={`status ${done ? 'ok' : 'wait'}`}>{status}</span>
                </span>
                {done ? null : e.kind === 'unbooked_fee' ? (
                  <ActionButton action={bookFeeAction.bind(null, e.id)} className="btn btn-secondary btn-sm" disabled={!canOps}>
                    Book fee adjustment
                  </ActionButton>
                ) : e.kind === 'deposit_no_tag' && e.queueId ? (
                  <Link href={`/queue?filter=all&sel=${e.queueId}`} className="btn btn-secondary btn-sm btnlike">
                    Open in approval queue
                  </Link>
                ) : e.kind === 'provider_delay' && !contacted ? (
                  <ActionButton action={contactProviderAction.bind(null, e.id)} className="btn btn-secondary btn-sm" disabled={!canOps}>
                    Mark provider contacted
                  </ActionButton>
                ) : null}
              </div>
            );
          })}
          {r.exceptions.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>No exceptions. Everything agrees.</p> : null}
          {roleNote ? (
            <div className="banner info" style={{ marginTop: 8 }}>
              {roleNote}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
