import type { ReactNode } from 'react';
import { Shell } from '@/components/Shell';
import { queueStatus } from '@/lib/data/status';
import { session } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const { me, data } = await session();
  const [queue, recon] = await Promise.all([data.queue(), data.recon()]);
  const waiting = queue.filter((q) => queueStatus(q)[1] === 'wait').length;
  const exceptions = recon.exceptions.filter((e) => e.status !== 'resolved').length;
  return (
    <Shell
      me={me}
      nav={[
        { href: '/', label: 'Overview', icon: 'adminOverview' },
        { href: '/queue', label: 'Approval queue', icon: 'adminQueue', count: waiting },
        { href: '/transactions', label: 'Transactions', icon: 'exchange' },
        { href: '/reconciliation', label: 'Reconciliation', icon: 'adminRecon', count: exceptions },
        { href: '/users', label: 'Users', icon: 'adminUsers' },
        { href: '/assets', label: 'Assets', icon: 'markets' },
        { href: '/custody', label: 'Custody', icon: 'shield' },
        { href: '/audit', label: 'Audit log', icon: 'adminAudit' },
      ]}
    >
      {children}
    </Shell>
  );
}
