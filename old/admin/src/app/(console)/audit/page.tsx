import Link from 'next/link';
import { ExportButton } from '@/components/ExportButton';
import { Icon } from '@/components/Icon';
import { EnvPill, PageHead } from '@/components/PageHead';
import { session } from '@/lib/session';

const FILTERS = [
  ['all', 'All'],
  ['staff', 'Staff'],
  ['customer', 'Customers'],
  ['system', 'System'],
] as const;
type Filter = (typeof FILTERS)[number][0];
const KIND = { staff: 'Staff', customer: 'Customer', system: 'System' } as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  const { data } = await session();
  const a = await data.audit();
  const filter: Filter = FILTERS.some(([k]) => k === sp.filter) ? (sp.filter as Filter) : 'all';
  const rows = a.rows.filter((r) => filter === 'all' || r.actorType === filter);

  return (
    <>
      <PageHead title="Audit log" sub="Every staff, customer and system action, in order." env={<EnvPill demo={data.mode === 'demo'} />} />
      <div className={`banner ${a.chainOk ? 'ok' : 'bad'}`}>
        <Icon name={a.chainOk ? 'check' : 'alertPath'} small style={{ marginTop: 1 }} />
        <span>
          Append-only and tamper-evident: each entry stores a hash of the one before it, so editing or deleting any entry breaks the chain.{' '}
          {a.chainOk ? `Chain verified today at ${a.verifiedAt}` : `Chain check FAILED at ${a.verifiedAt} — escalate to Compliance`} · {rows.length} entries
          shown.
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="tabs" role="group" aria-label="Filter by actor">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={`/audit?filter=${k}`} className={`tab btnlike ${filter === k ? 'on' : ''}`} aria-current={filter === k ? 'true' : undefined}>
              {label}
            </Link>
          ))}
        </div>
        <ExportButton filter={filter} />
      </div>
      <section className="card" aria-label="Audit log" style={{ overflow: 'hidden' }}>
        <div className="q-head g5" aria-hidden="true">
          <span>Time</span>
          <span>Actor</span>
          <span>Action</span>
          <span className="hide-sm">Target</span>
          <span className="hide-sm">Hash</span>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="q-row g5 static" style={{ fontSize: 13 }}>
            <span className="num mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {r.at}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontWeight: 500 }}>{r.actor}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{KIND[r.actorType]}</span>
            </span>
            <span>{r.action}</span>
            <span className="mono hide-sm" style={{ fontSize: 12 }}>
              {r.target}
            </span>
            <span className="mono hide-sm" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              {r.hash}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
