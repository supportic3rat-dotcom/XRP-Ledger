import Link from 'next/link';
import { EnvPill, PageHead } from '@/components/PageHead';
import { session } from '@/lib/session';
import { xrp0, xrp2 } from '@/lib/format';

export default async function OverviewPage() {
  const { data } = await session();
  const o = await data.overview();
  const pct = o.outflowLimitDrops === 0n ? 0 : Number((o.outflowTodayDrops * 1000n) / o.outflowLimitDrops) / 10;
  const metrics = [
    { label: 'Pending approvals', value: String(o.pending), note: o.oldest, tone: o.pending ? 'wait' : 'ok', href: '/queue' },
    {
      label: 'Customer liabilities',
      value: `${xrp2(o.liabilitiesDrops)} XRP`,
      note: `${o.coveragePct} covered by holdings`,
      tone: 'ok',
      href: '/reconciliation',
    },
    {
      label: 'Reconciliation exceptions',
      value: String(o.exceptionsOpen),
      note: o.exceptionsOpen ? `Last run ${o.lastRun}` : 'All clear',
      tone: o.exceptionsOpen ? 'wait' : 'ok',
      href: '/reconciliation',
    },
    {
      label: 'Outflow today',
      value: `${xrp0(o.outflowTodayDrops)} XRP`,
      note: `${pct.toFixed(1)}% of ${xrp0(o.outflowLimitDrops)} daily limit`,
      tone: 'ok',
      href: '/custody',
    },
  ];
  return (
    <>
      <PageHead title="Overview" sub="Platform health at a glance. Click any card to drill in." env={<EnvPill demo={data.mode === 'demo'} />} />
      <div className="metrics">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href} className="card metric btnlike">
            <span className="lbl">{m.label}</span>
            <span className="num val">{m.value}</span>
            <span className={`status ${m.tone}`}>{m.note}</span>
          </Link>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section className="card" aria-label="Provider health" style={{ flex: '1 1 420px', minWidth: 0, padding: 18 }}>
          <h3 className="sec-t">Provider health</h3>
          {o.providers.map((p) => (
            <div key={p.name} className="chk mid">
              <span style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{p.note}</span>
              </span>
              <span className={`status ${p.tone}`}>{p.status}</span>
            </div>
          ))}
        </section>
        <section className="card" aria-label="Needs attention" style={{ flex: '1 1 420px', minWidth: 0, padding: 18 }}>
          <h3 className="sec-t">Needs attention</h3>
          {o.attention.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>Nothing needs attention.</p> : null}
          {o.attention.map((a) => (
            <Link key={a.title} href={a.href} className="att btnlike">
              <span className={`status ${a.tone}`} aria-hidden="true" />
              <span style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span className="att-t" style={{ fontWeight: 500 }}>
                  {a.title}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.note}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.where} →</span>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
