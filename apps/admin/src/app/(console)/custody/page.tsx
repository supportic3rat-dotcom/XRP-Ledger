import { policyAction } from '@/app/actions';
import { ActionButton } from '@/components/ActionButton';
import { EnvPill, PageHead } from '@/components/PageHead';
import { shortAddr, xrp0, xrp2 } from '@/lib/format';
import { session } from '@/lib/session';

/** Share of holdings to one decimal, rounded half-up in integer maths. */
const share = (part: bigint, total: bigint) => (total === 0n ? '0.0%' : `${(Number((part * 2000n + total) / (2n * total)) / 10).toFixed(1)}%`);

export default async function CustodyPage() {
  const { me, data } = await session();
  const c = await data.custody();
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
  const disabled = !isComp || p?.status !== 'pending';

  return (
    <>
      <PageHead
        title="Custody"
        sub="Wallets, signing policy and limits. Policy changes need approval from a second role."
        env={<EnvPill demo={data.mode === 'demo'} />}
      />
      <section className="card" aria-label="Wallets" style={{ padding: 18, overflowX: 'auto' }}>
        <h3 className="sec-t">Wallets · [Custody provider]</h3>
        <table className="jl">
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Address</th>
              <th className="r">Balance (XRP)</th>
              <th className="r">Share</th>
              <th>Signing</th>
            </tr>
          </thead>
          <tbody>
            {c.wallets.map((w) => (
              <tr key={w.name}>
                <td style={{ fontWeight: 500 }}>{w.name}</td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {shortAddr(w.address, w.tier === 'warm' || w.tier === 'cold' ? 10 : 9, 4)}
                </td>
                <td className="r">{xrp2(w.balanceDrops)}</td>
                <td className="r">{share(w.balanceDrops, total)}</td>
                <td>{w.signing}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td />
              <td className="r">{xrp2(total)}</td>
              <td className="r">100%</td>
              <td />
            </tr>
          </tbody>
        </table>
        {hot?.ceilingDrops ? (
          <div className="banner info" style={{ marginTop: 12 }}>
            Hot wallet is at {xrp0(hot.balanceDrops)} of its {xrp0(hot.ceilingDrops)} XRP ceiling. Top-ups from warm need 2 of 3 signers; keys never leave the
            provider’s security boundary.
          </div>
        ) : null}
      </section>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section className="card" aria-label="Signing policy" style={{ flex: '1 1 420px', minWidth: 0, padding: 18 }}>
          <h3 className="sec-t">Signing policy · {c.policyVersion}</h3>
          <dl className="kv">{c.policy.map(([k, v]) => [<dt key={`${k}-k`}>{k}</dt>, <dd key={`${k}-v`}>{v}</dd>])}</dl>
          <h3 className="sec-t" style={{ marginTop: 20 }}>
            Signers
          </h3>
          {c.signers.map((s) => (
            <div key={s.name} className="chk mid">
              <span style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontWeight: 500 }}>{s.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.meta}</span>
              </span>
              <span className={`status ${s.status === 'Active' ? 'ok' : 'off'}`}>{s.status}</span>
            </div>
          ))}
        </section>
        <section
          className="card"
          aria-label="Limits"
          style={{ flex: '1 1 420px', minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div>
            <h3 className="sec-t">Limits</h3>
            <dl className="kv">
              <dt>Per customer, daily</dt>
              <dd className="num">{xrp0(c.limits.customerDailyDrops)} XRP</dd>
              <dt>Per transaction (auto-sign)</dt>
              <dd className="num">{xrp0(c.limits.autoSignDrops)} XRP</dd>
              <dt>Platform outflow, daily</dt>
              <dd className="num">
                {xrp0(c.limits.outflowTodayDrops)} of {xrp0(c.limits.platformDailyDrops)} XRP
              </dd>
            </dl>
            <div className="bar" role="img" aria-label={`${pct} percent of daily outflow limit used`} style={{ marginTop: 10 }}>
              <span style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
          <div>
            <h3 className="sec-t">Pending policy change</h3>
            {p ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{p.title}</span>
                  <span style={{ color: 'var(--text-3)' }}>
                    Requested by {p.requestedRole === 'operations' ? 'Operations' : 'Compliance'} · {p.requestedBy} · {p.when} · “{p.reason}”
                  </span>
                  <span className={`status ${pTone}`}>{pStatus}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <ActionButton action={policyAction.bind(null, p.id, 'decline')} className="btn btn-danger" disabled={disabled}>
                    Decline
                  </ActionButton>
                  <ActionButton action={policyAction.bind(null, p.id, 'approve')} className="btn btn-primary" disabled={disabled}>
                    Approve change
                  </ActionButton>
                </div>
                {block ? <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>{block}</p> : null}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>No pending changes.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
