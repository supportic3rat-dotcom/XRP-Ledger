import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Card } from '@/components/Card';
import { Row } from '@/components/Row';
import { Status } from '@/components/Status';
import { T } from '@/components/T';
import { queueStatus } from '../data/status';
import type { QueueKind } from '../data/types';
import { useOps } from '../hooks';
import { Empty, FilterTabs, Loading, OpsScreen } from '../ui';

const FILTERS: { key: QueueKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'withdrawal', label: 'Withdrawals' },
  { key: 'deposit', label: 'Deposit exceptions' },
  { key: 'exchange', label: 'Exchange' },
  { key: 'loan', label: 'Loans' },
  { key: 'yield', label: 'Yield' },
];

export const QueueScreen = () => {
  const router = useRouter();
  const q = useOps('queue', (d) => d.queue());
  const [filter, setFilter] = useState<QueueKind | 'all'>('all');
  const items = q.data ?? [];
  const rows = items.filter((it) => filter === 'all' || it.kind === filter);

  return (
    <OpsScreen
      tab
      title="Approval queue"
      sub="Requests waiting on a staff decision. Every action is logged with your role and reason."
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
    >
      <FilterTabs
        label="Filter by type"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ ...f, count: f.key === 'all' ? items.length : items.filter((x) => x.kind === f.key).length }))}
      />
      {!q.data ? (
        <Loading error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card>
          {rows.map((r, i) => {
            const [status, tone] = queueStatus(r);
            return (
              <Row
                key={r.id}
                first={i === 0}
                chevron
                onPress={() => router.push(`/ops/approval/${r.id}`)}
                accessibilityLabel={`${r.ref}, ${r.type}, ${r.amount}, ${status}`}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T size={12.5} mono weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {r.ref}
                    </T>
                    <T size={13.5} num weight={500}>
                      {r.amount}
                    </T>
                  </View>
                  <T size={13}>{r.type}</T>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T size={11.5} mono color="text3">
                      {`${r.customer} · ${r.age}`}
                    </T>
                    <Status tone={tone} label={status} />
                  </View>
                </View>
              </Row>
            );
          })}
          {rows.length === 0 ? <Empty>Nothing waiting in this category.</Empty> : null}
        </Card>
      )}
    </OpsScreen>
  );
};
