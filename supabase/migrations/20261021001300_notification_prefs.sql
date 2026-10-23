-- Notification preferences from the web dashboard's Settings (transaction emails, price alerts).
alter table public.customers add column if not exists email_receipts boolean not null default true;
alter table public.customers add column if not exists price_alerts boolean not null default false;

create or replace function public.set_notification_prefs(p_receipts boolean, p_alerts boolean) returns void
language sql security definer set search_path = public as $$
  update customers set email_receipts = coalesce(p_receipts, email_receipts), price_alerts = coalesce(p_alerts, price_alerts)
  where id = auth.uid();
$$;
revoke execute on function public.set_notification_prefs from anon, public;
grant execute on function public.set_notification_prefs to authenticated;
