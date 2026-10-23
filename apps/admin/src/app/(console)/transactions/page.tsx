import { asset as assetSpec } from '@xrp/ledger';
import Link from 'next/link';
import { ManualSendPanel } from '@/components/AssetForms';
import { Journal, Timeline } from '@/components/Journal';
import { EnvPill, PageHead } from '@/components/PageHead';
import type { TxItem } from '@/lib/data/types';
import { session } from '@/lib/session';

const FILTERS: [TxItem['kind'] | 'all', string][] = [
  ['all', 'All'],
  ['deposit', 'Deposits'],
  ['withdrawal', 'Withdrawals'],
  ['exchange', 'Exchange'],
  ['yield', 'Yield'],
  ['loan', 'Loans'],
];

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ filter?: string; sel?: string }> }) {
  const sp = await searchParams;
  const { me, data } = await session();
  const txs = await data.transactions();
  const filter = FILTERS.some(([k]) => k === sp.filter) ? (sp.filter as TxItem['kind'] | 'all') : 'all';
  const list = txs.filter((t) => filter === 'all' || t.kind === filter);
  const t = txs.find((x) => x.id === sp.sel) ?? txs.find((x) => x.queueId) ?? txs[0];
  const href = (f: string, sel?: string) => `/transactions?filter=${f}${(sel ?? t?.id) ? `&sel=${sel ?? t?.id}` : ''}`;

  return (
    <>
      <PageHead
        title="Transactions"
        sub="Every customer movement with its ledger journal and on-ledger evidence."
        env={<EnvPill demo={data.mode === 'demo'} />}
      />
      <div className="tabs" role="group" aria-label="Filter transactions">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={href(k)} className={`tab btnlike ${filter === k ? 'on' : ''}`} aria-current={filter === k ? 'true' : undefined}>
            {label} <span className="n">{k === 'all' ? txs.length : txs.filter((x) => x.kind === k).length}</span>
          </Link>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section className="card" aria-label="Transactions" style={{ flex: '999 1 560px', minWidth: 0, overflow: 'hidden' }}>
          <div className="q-head g6" aria-hidden="true">
            <span>Reference</span>
            <span className="hide-sm">Customer</span>
            <span>Type</span>
            <span className="hide-sm">Amount</span>
            <span className="hide-sm">Time</span>
            <span>Status</span>
          </div>
          {list.map((r) => {
            const on = r.id === t?.id;
            return (
              <Link key={r.id} href={href(filter, r.id)} scroll={false} className={`q-row g6 btnlike ${on ? 'on' : ''}`} aria-current={on ? 'true' : undefined}>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>
                  {r.ref}
                </span>
                <span className="mono hide-sm" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {r.customer}
                </span>
                <span>{r.type}</span>
                <span className="num hide-sm" style={{ fontWeight: 500 }}>
                  {r.amount}
                </span>
                <span className="num hide-sm" style={{ color: 'var(--text-3)' }}>
                  {r.time}
                </span>
                <span className={`status ${r.tone}`}>{r.status}</span>
              </Link>
            );
          })}
          {list.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>No transactions in this category.</div>
          ) : null}
        </section>
        {t ? (
          <section
            className="card"
            aria-labelledby="tx-title"
            style={{ flex: '1 1 380px', minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                  {t.ref} · {t.customer}
                </span>
                <span className={`status ${t.tone}`}>{t.status}</span>
              </div>
              <h2 id="tx-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                {t.type} · <span className="num">{t.amount}</span>
              </h2>
            </div>
            <dl className="kv">
              {t.rows.map((r) => [
                <dt key={`${r.k}-k`}>{r.k}</dt>,
                <dd key={`${r.k}-v`} className={r.mono ? 'mono' : ''}>
                  {r.v}
                </dd>,
              ])}
            </dl>
            {t.journal.length ? (
              <div>
                <h3 className="sec-t">Ledger journal</h3>
                <Journal rows={t.journal} />
              </div>
            ) : null}
            <div>
              <h3 className="sec-t">Timeline</h3>
              <Timeline rows={t.timeline} />
            </div>
            {t.manualSend ? <ManualSendPanel key={t.id} txId={t.id} asset={t.asset} network={assetSpec(t.asset).network} disabled={me.role === 'auditor'} /> : null}
            {t.queueId ? (
              <Link href={`/queue?filter=all&sel=${t.queueId}`} className="btn btn-secondary btnlike">
                Open in approval queue
              </Link>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
