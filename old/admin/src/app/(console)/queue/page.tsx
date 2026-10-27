import Link from 'next/link';
import { Check } from '@/components/Check';
import { DecisionPanel } from '@/components/DecisionPanel';
import { Icon } from '@/components/Icon';
import { Journal, Timeline } from '@/components/Journal';
import { EnvPill, PageHead } from '@/components/PageHead';
import { nextStep, queueStatus } from '@/lib/data/status';
import { type QueueItem, type QueueKind, ROLES, type Staff } from '@/lib/data/types';
import { approveBlock, canReject } from '@/lib/rules';
import { session } from '@/lib/session';

const FILTERS: [QueueKind | 'all', string][] = [
  ['all', 'All'],
  ['withdrawal', 'Withdrawals'],
  ['deposit', 'Deposit exceptions'],
  ['exchange', 'Exchange'],
  ['loan', 'Loans'],
  ['yield', 'Yield'],
];

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ filter?: string; sel?: string }> }) {
  const sp = await searchParams;
  const { me, data } = await session();
  const items = await data.queue();
  const filter = FILTERS.some(([k]) => k === sp.filter) ? (sp.filter as QueueKind | 'all') : 'all';
  const rows = items.filter((it) => filter === 'all' || it.kind === filter);
  const it = items.find((x) => x.id === sp.sel) ?? items[0];
  const href = (f: string, sel?: string) => `/queue?filter=${f}${sel ? `&sel=${sel}` : it ? `&sel=${it.id}` : ''}`;

  return (
    <>
      <PageHead
        title="Approval queue"
        sub="Requests waiting on a staff decision. Every action is logged with your role and reason."
        env={<EnvPill demo={data.mode === 'demo'} />}
      />
      <div className="tabs" role="group" aria-label="Filter by type">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={href(k)} className={`tab btnlike ${filter === k ? 'on' : ''}`} aria-current={filter === k ? 'true' : undefined}>
            {label} <span className="n">{k === 'all' ? items.length : items.filter((x) => x.kind === k).length}</span>
          </Link>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section className="card" aria-label="Queue" style={{ flex: '999 1 520px', minWidth: 0, overflow: 'hidden' }}>
          <div className="q-head" aria-hidden="true">
            <span>Reference</span>
            <span>Type</span>
            <span className="hide-sm">Amount</span>
            <span className="hide-sm">Age</span>
            <span>Status</span>
          </div>
          {rows.map((r) => {
            const [status, tone] = queueStatus(r);
            const on = r.id === it?.id;
            return (
              <Link key={r.id} href={href(filter, r.id)} scroll={false} className={`q-row btnlike ${on ? 'on' : ''}`} aria-current={on ? 'true' : undefined}>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
                    {r.ref}
                  </span>
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {r.customer}
                  </span>
                </span>
                <span>{r.type}</span>
                <span className="num hide-sm" style={{ fontWeight: 500 }}>
                  {r.amount}
                </span>
                <span className="num hide-sm" style={{ color: 'var(--text-3)' }}>
                  {r.age}
                </span>
                <span className={`status ${tone}`}>{status}</span>
              </Link>
            );
          })}
          {rows.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>Nothing waiting in this category.</div>
          ) : null}
        </section>
        {it ? <Detail it={it} me={me} /> : null}
      </div>
    </>
  );
}

const Detail = ({ it, me }: { it: QueueItem; me: Staff }) => {
  const [status, tone] = queueStatus(it);
  const block = approveBlock(it, me);
  const rejected = it.decided?.kind === 'rejected';
  const done = it.decided !== null || it.approvals.length >= it.required;
  const mine = it.approvals.some((a) => a.staffId === me.id);
  const outcome = rejected
    ? `Rejected. Customer notified with your reason${it.journal.length ? '; reserved funds released via compensating entry.' : '.'}`
    : done
      ? nextStep(it.kind)
      : mine
        ? 'Your approval is recorded. Waiting for a second approver.'
        : '';
  return (
    <section
      className="card"
      aria-labelledby="d-title"
      style={{ flex: '1 1 400px', minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            {it.ref} · {it.customer}
          </span>
          <span className={`status ${tone}`}>{status}</span>
        </div>
        <h2 id="d-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          {it.type} · <span className="num">{it.amount}</span>
        </h2>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{it.summary}</span>
      </div>
      <div>
        <h3 className="sec-t">Checks</h3>
        {it.checks.map((c) => (
          <Check key={c.label} {...c} />
        ))}
      </div>
      <div>
        <h3 className="sec-t">
          Approvals · {it.approvals.length} of {it.required} required
        </h3>
        {it.approvals.map((a) => (
          <div key={a.staffId} className="chk">
            <Icon name="check" small style={{ marginTop: 1, color: 'var(--pos)' }} />
            <span style={{ flex: 1 }}>
              {ROLES[a.role].name} · {a.staffId === me.id ? 'you' : a.who}
            </span>
            <span className="num" style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {a.at}
            </span>
          </div>
        ))}
        {it.required > 1 ? (
          <div className="banner info" style={{ marginTop: 6 }}>
            Over 1,000 XRP: two approvals from different people, at least one from Compliance.
          </div>
        ) : null}
      </div>
      {it.journal.length ? (
        <div>
          <h3 className="sec-t">Ledger journal</h3>
          <Journal rows={it.journal} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--pos)' }}>
            <Icon name="check" small />
            Balanced · posted entries are never edited
          </span>
        </div>
      ) : null}
      <div>
        <h3 className="sec-t">Audit trail</h3>
        <Timeline rows={it.audit} />
      </div>
      {!done && !mine ? (
        <DecisionPanel
          key={it.id}
          queueId={it.id}
          approveLabel={
            it.kind === 'deposit' ? (it.type.startsWith('Deposit confirmation') ? `Confirmed on network · credit ${it.customer}` : `Approve attribution to ${it.claimant ?? 'claimant'}`) : it.kind === 'exchange' ? 'Approve · request quote' : 'Approve'
          }
          approveBlock={block}
          rejectDisabled={!canReject(it, me.role)}
        />
      ) : null}
      {outcome ? (
        <div className={`banner ${rejected ? 'bad' : 'ok'}`} role="status">
          {outcome}
        </div>
      ) : null}
    </section>
  );
};
