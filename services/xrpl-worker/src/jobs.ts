import type { Store } from './store.ts';

/**
 * Scheduled upkeep, run by the worker instead of pg_cron. Interval jobs run at start-up and then every `everyMs`;
 * daily jobs run once per UTC day, at or after `atUtcMinute` (minutes past midnight UTC).
 */
export type JobName = 'quote-expiry' | 'ltv-check' | 'mfa-disable' | 'balances-snapshot' | 'yield-accrual' | 'audit-verify' | 'recon';
export type Job = { name: JobName; everyMs: number } | { name: JobName; atUtcMinute: number };

const MIN = 60_000;

export const JOBS: Job[] = [
  { name: 'quote-expiry', everyMs: MIN },
  { name: 'ltv-check', everyMs: 5 * MIN },
  { name: 'mfa-disable', everyMs: 5 * MIN },
  { name: 'balances-snapshot', everyMs: 10 * MIN },
  { name: 'yield-accrual', everyMs: 60 * MIN },
  { name: 'recon', atUtcMinute: 23 * 60 }, // 00:00 WAT
  { name: 'audit-verify', atUtcMinute: 23 * 60 + 30 },
];

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The jobs due at `now`, given when each last ran (epoch ms). */
export const dueJobs = (jobs: Job[], now: number, lastRun: ReadonlyMap<JobName, number>): JobName[] =>
  jobs
    .filter((job) => {
      const last = lastRun.get(job.name);
      if ('everyMs' in job) return last === undefined || now - last >= job.everyMs;
      const d = new Date(now);
      const pastTime = d.getUTCHours() * 60 + d.getUTCMinutes() >= job.atUtcMinute;
      return pastTime && (last === undefined || utcDay(last) !== utcDay(now));
    })
    .map((job) => job.name);

export type JobDeps = {
  store: Pick<Store, 'runJob'>;
  /** Calls the recon-run Edge Function; null when CRON_SECRET isn't set, and reconciliation is then skipped. */
  runRecon: (() => Promise<void>) | null;
  log: (msg: string, extra?: unknown) => void;
};

/** Runs every due job once, one after another. A failed job is logged and retried at its next slot. */
export const runDueJobs = async (deps: JobDeps, now: number, lastRun: Map<JobName, number>, jobs: Job[] = JOBS) => {
  for (const name of dueJobs(jobs, now, lastRun)) {
    lastRun.set(name, now);
    try {
      if (name === 'recon') {
        if (deps.runRecon) await deps.runRecon();
        else deps.log('daily reconciliation skipped: CRON_SECRET is not set');
      } else await deps.store.runJob(name);
    } catch (e) {
      deps.log('job failed', { job: name, error: e instanceof Error ? e.message : String(e) });
    }
  }
};

/** POSTs to recon-run with the shared cron secret (the function's gateway JWT check is off; see config.toml). */
export const reconCaller = (supabaseUrl: string, cronSecret: string) => async () => {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/recon-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
    body: '{}',
  });
  if (!res.ok) throw new Error(`recon-run returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
};
