-- Scheduled jobs and the routines they call.

-- LTV monitor: recompute from the latest price. 55% alert, 65% margin call, 80% flag for the lending provider.
-- It never sells anything itself.
create or replace function public.ltv_check() returns void
language plpgsql security definer set search_path = public as $$
declare
  l loans;
  price bigint;
  owed bigint;
  ltv int;
begin
  select usd_micro into price from prices where asset = 'XRP' order by at desc limit 1;
  if price is null then return; end if;
  for l in select * from loans where status in ('active', 'margin_call') for update loop
    owed := l.principal_usd_cents + l.interest_usd_cents - l.repaid_usd_cents;
    ltv := round(owed::numeric * 1e14 / nullif(l.collateral_drops::numeric * price, 0));
    if ltv >= l.liquidation_bps and l.status <> 'liquidating' then
      update loans set status = 'liquidating' where id = l.id;
      perform audit('system', 'ltv-monitor', 'System', null, 'Flagged loan for liquidation by lending provider', l.ref);
    elsif ltv >= l.margin_bps and l.status = 'active' then
      update loans set status = 'margin_call' where id = l.id;
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (l.customer_id, 'tx', 'warn', 'alert', 'Margin call', 'LTV on ' || l.ref || ' is above 65%. Add collateral or repay before it reaches 80%.', '/loan/manage');
    elsif ltv >= 5500 and ltv < l.margin_bps and not exists (
      select 1 from notifications where customer_id = l.customer_id and title = 'LTV above 55%' and created_at > now() - interval '1 day'
    ) then
      insert into notifications (customer_id, type, tone, icon, title, body, link)
      values (l.customer_id, 'tx', 'warn', 'alert', 'LTV above 55%', 'Your loan ' || l.ref || ' is getting closer to the 65% margin call.', '/borrow');
    elsif ltv < l.margin_bps and l.status = 'margin_call' then
      update loans set status = 'active' where id = l.id;
    end if;
  end loop;
end $$;

-- Quotes past expires_at move the exchange to quote_expired. Nothing was reserved, so no journal.
create or replace function public.expire_quotes() returns void
language plpgsql security definer set search_path = public as $$
declare
  t record;
begin
  for t in
    select tx.id from transactions tx join quotes q on q.transaction_id = tx.id
    where tx.kind = 'exchange' and tx.status = 'quoted' and q.accepted_at is null and q.expires_at < now()
  loop
    perform transition_tx(t.id, 'quote_expired', 'System', 'Firm quote expired');
  end loop;
end $$;

-- Yield accrual estimate (labelled as an estimate in the UI; never posted to the journal).
create or replace function public.estimate_yield_accrual() returns void
language sql security definer set search_path = public as $$
  update yield_positions
  set estimated_accrued_drops = round(allocated_drops::numeric * apr_bps * extract(epoch from now() - rate_updated_at) / (10000::numeric * 365 * 86400))
  where allocated_drops > 0;
$$;

-- Scheduled by the XRPL worker through public.run_job (20261023000100_worker_jobs.sql); no pg_cron.
