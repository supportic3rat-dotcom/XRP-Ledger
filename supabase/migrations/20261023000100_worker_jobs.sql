-- Scheduled upkeep without pg_cron: the XRPL worker calls run_job on its own timers (services/xrpl-worker/src/jobs.ts).
-- Only the service role can run a job; the job functions themselves are no longer callable from the API.

create or replace function public.run_job(p_job text) returns void
language plpgsql security definer set search_path = public as $$
begin
  case p_job
    when 'ltv-check' then perform public.ltv_check();
    when 'quote-expiry' then perform public.expire_quotes();
    when 'yield-accrual' then perform public.estimate_yield_accrual();
    when 'audit-verify' then perform public.run_audit_verification();
    when 'mfa-disable' then perform public.apply_mfa_disable();
    when 'balances-snapshot' then refresh materialized view concurrently public.balances_snapshot;
    else raise exception 'Unknown job: %', p_job using errcode = '22023';
  end case;
end $$;

revoke execute on function public.run_job(text) from public, anon, authenticated;
grant execute on function public.run_job(text) to service_role;

revoke execute on function public.ltv_check(), public.expire_quotes(), public.estimate_yield_accrual(), public.run_audit_verification()
  from public, anon, authenticated;
