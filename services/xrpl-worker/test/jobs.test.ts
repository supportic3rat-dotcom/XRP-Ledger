import { describe, expect, it } from 'vitest';
import { dueJobs, type Job, type JobName, runDueJobs } from '../src/jobs.ts';
import { fakeStore } from './fakes.ts';

const at = (iso: string) => Date.parse(iso);
const jobs: Job[] = [
  { name: 'quote-expiry', everyMs: 60_000 },
  { name: 'recon', atUtcMinute: 23 * 60 },
];

describe('dueJobs', () => {
  it('runs interval jobs at start-up, then once per interval', () => {
    const last = new Map<JobName, number>();
    expect(dueJobs(jobs, at('2026-10-23T10:00:00Z'), last)).toEqual(['quote-expiry']);
    last.set('quote-expiry', at('2026-10-23T10:00:00Z'));
    expect(dueJobs(jobs, at('2026-10-23T10:00:59Z'), last)).toEqual([]);
    expect(dueJobs(jobs, at('2026-10-23T10:01:00Z'), last)).toEqual(['quote-expiry']);
  });

  it('runs daily jobs once per UTC day, at or after their time', () => {
    const last = new Map<JobName, number>([['quote-expiry', at('2026-10-23T22:59:59Z')]]);
    expect(dueJobs(jobs, at('2026-10-23T22:59:59Z'), last)).toEqual([]);
    expect(dueJobs(jobs, at('2026-10-23T23:00:00Z'), last)).toEqual(['recon']);
    last.set('recon', at('2026-10-23T23:00:00Z'));
    last.set('quote-expiry', at('2026-10-23T23:59:00Z'));
    expect(dueJobs(jobs, at('2026-10-23T23:59:30Z'), last)).toEqual([]);
    expect(dueJobs(jobs, at('2026-10-24T23:00:10Z'), last)).toContain('recon');
  });
});

describe('runDueJobs', () => {
  it('runs database jobs through the store and skips recon without a secret', async () => {
    const store = fakeStore();
    const logs: string[] = [];
    await runDueJobs({ store, runRecon: null, log: (m) => logs.push(m) }, at('2026-10-23T23:10:00Z'), new Map(), jobs);
    expect(store.rec.events).toEqual(['job:quote-expiry']);
    expect(logs).toEqual(['daily reconciliation skipped: CRON_SECRET is not set']);
  });

  it('logs a failed job and carries on with the rest', async () => {
    const logs: unknown[] = [];
    let recon = 0;
    const store = { runJob: async () => Promise.reject(new Error('boom')) };
    await runDueJobs(
      { store, runRecon: async () => void recon++, log: (m, extra) => logs.push({ m, extra }) },
      at('2026-10-23T23:10:00Z'),
      new Map(),
      jobs,
    );
    expect(recon).toBe(1);
    expect(logs).toEqual([{ m: 'job failed', extra: { job: 'quote-expiry', error: 'boom' } }]);
  });
});
