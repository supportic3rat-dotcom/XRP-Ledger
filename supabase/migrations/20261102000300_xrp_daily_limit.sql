-- Owner's decision: customers can withdraw up to 1,000,000 XRP a day (was 25,000).
update public.limits set amount_drops = 1000000000000 where id = 'customer_daily';
update public.assets set daily_limit = 1000000000000 where id = 'XRP';
