import { useState } from 'react';
import { Share, View } from 'react-native';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Row } from '@/components/Row';
import { T } from '@/components/T';
import { useOps, useOpsAction, useStaffSession } from '../hooks';
import { Empty, FilterTabs, Loading, OpsScreen } from '../ui';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'staff', label: 'Staff' },
  { key: 'customer', label: 'Customers' },
  { key: 'system', label: 'System' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];
const KIND = { staff: 'Staff', customer: 'Customer', system: 'System' } as const;

export const AuditScreen = () => {
  const { data } = useStaffSession();
  const { pending, run } = useOpsAction();
  const q = useOps('audit', (d) => d.audit());
  const [filter, setFilter] = useState<Filter>('all');
  const a = q.data;
  const rows = (a?.rows ?? []).filter((r) => filter === 'all' || r.actorType === filter);

  // The export runs on the server and is itself audited; the phone hands the CSV to the share sheet.
  const exportCsv = () =>
    void run(async () => {
      const r = await data.exportAudit(filter);
      if (r.ok && r.csv) await Share.share({ title: r.filename ?? 'audit-log.csv', message: r.csv }).catch(() => undefined);
      return r;
    });

  return (
    <OpsScreen title="Audit log" sub="Every staff, customer and system action, in order." refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {!a ? (
        <Loading error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Banner tone={a.chainOk ? 'info' : 'error'} icon={a.chainOk ? 'checkCircle' : 'alertPath'} size={12.5}>
            {`Append-only and tamper-evident: each entry stores a hash of the one before it, so editing or deleting any entry breaks the chain. ${
              a.chainOk ? `Chain verified today at ${a.verifiedAt}` : `Chain check FAILED at ${a.verifiedAt} — escalate to Compliance`
            } · ${rows.length} entries shown.`}
          </Banner>
          <FilterTabs label="Filter by actor" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ ...f }))} />
          <Button label="Export CSV" variant="secondary" size={40} loading={pending} onPress={exportCsv} style={{ alignSelf: 'flex-start' }} />
          <Card>
            {rows.map((r, i) => (
              <Row key={r.id} first={i === 0} minHeight={0} align="flex-start">
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T size={13.5} weight={500} style={{ flexShrink: 1 }}>
                      {r.actor}
                      <T size={12} color="text3">{` · ${KIND[r.actorType]}`}</T>
                    </T>
                    <T size={12} mono color="text3">
                      {r.at}
                    </T>
                  </View>
                  <T size={13}>{r.action}</T>
                  <T size={11.5} mono color="text3" numberOfLines={1}>
                    {`${r.target} · ${r.hash}`}
                  </T>
                </View>
              </Row>
            ))}
            {rows.length === 0 ? <Empty>No entries.</Empty> : null}
          </Card>
        </>
      )}
    </OpsScreen>
  );
};
