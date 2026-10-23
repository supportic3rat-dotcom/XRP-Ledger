import { fnSchemas } from '@xrp/schemas';
import { defineFunction, serve } from '../_shared/handler.ts';

type AuditRow = { id: number; at: string; actor_type: string; actor_name: string; role: string | null; action: string; target: string; hash: string };

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  // Quote everything; neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Server-side CSV export of the audit log under the caller's RLS. The export is itself audited. */
export const handler = defineFunction({
  name: 'audit-export',
  schema: fnSchemas['audit-export'],
  access: { kind: 'staff' },
  run: async (ctx) => {
    const db = ctx.asUser ?? ctx.db;
    let query = db.from('audit_events').select('id, at, actor_type, actor_name, role, action, target, hash').order('id', { ascending: true }).limit(50_000);
    if (ctx.input.filter !== 'all') query = query.eq('actor_type', ctx.input.filter);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as AuditRow[];
    const header = ['id', 'at', 'actor_type', 'actor', 'role', 'action', 'target', 'hash'];
    const csv = [header.join(','), ...rows.map((r) => [r.id, r.at, r.actor_type, r.actor_name, r.role, r.action, r.target, r.hash].map(csvCell).join(','))].join('\n');
    await ctx.rpc('audit_export_logged', { p_filter: ctx.input.filter, p_rows: rows.length }, 'user');
    return { filename: `audit-log-${ctx.input.filter}-${ctx.now().toISOString().slice(0, 10)}.csv`, csv };
  },
});

if (import.meta.main) serve(handler);
