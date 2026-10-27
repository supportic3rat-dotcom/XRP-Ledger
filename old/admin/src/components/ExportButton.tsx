'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { exportAuditAction } from '@/app/actions';
import { useToast } from './Toast';

/** Server-side export; the browser only saves the CSV it returns. The export itself is audited. */
export const ExportButton = ({ filter }: { filter: 'all' | 'staff' | 'customer' | 'system' }) => {
  const router = useRouter();
  const say = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await exportAuditAction(filter);
          if (!r.ok) {
            say(r.error);
            return;
          }
          if (r.csv) {
            const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv' }));
            const a = Object.assign(document.createElement('a'), { href: url, download: r.filename ?? 'audit-log.csv' });
            a.click();
            URL.revokeObjectURL(url);
          }
          if (r.message) say(r.message);
          router.refresh();
        })
      }
    >
      Export CSV
    </button>
  );
};
