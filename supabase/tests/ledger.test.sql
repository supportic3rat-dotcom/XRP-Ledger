-- pgTAP suite for `supabase test db`. The same checks run without Docker via `pnpm --filter @xrp/supabase test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select is((select balance_drops from balances where customer_id = '00000000-0000-4000-8000-000000000042' and kind = 'available'),
          4170100000::bigint, 'seed available balance is 4,170.10 XRP');
select throws_like($$update journal_lines set amount_drops = 1 where id = (select min(id) from journal_lines)$$, '%append-only%',
                   'posted lines are immutable');
select throws_like($$delete from audit_events where id = 1$$, '%append-only%', 'audit log is append-only');
select throws_like($$select create_tx('00000000-0000-4000-8000-000000000042', 'withdrawal', 'WD-T', 'requested', 999999000000, 't')$$,
                   '%Insufficient balance%', 'available can never go negative');
select throws_like($$select transition_tx('10000000-0000-4000-8000-000000002041', 'credited', 't')$$, '%not allowed%',
                   'transition_tx enforces the state machine');
select is(public.verify_audit_chain(), null, 'audit chain verifies');

-- Customer session
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000042"}', true);
set local role authenticated;
select is((select count(*)::int from transactions where customer_id <> '00000000-0000-4000-8000-000000000042'), 0, 'customers see only their rows');
select throws_like($$insert into transactions (ref, kind, status) values ('X', 'deposit', 'credited')$$, '%permission denied%',
                   'customers cannot write money tables');
reset role;

-- Staff sessions
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-00000000c002","app_role":"compliance","aal":"aal2"}', true);
set local role authenticated;
select throws_like($$select approval_decide('30000000-0000-4000-8000-000000002042', 'approve')$$, '%different role%',
                   'second approval must come from a different role');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-00000000a001","app_role":"operations","aal":"aal2"}', true);
set local role authenticated;
select is((select full_name from customers_masked where account_ref = 'CUS-0042'), 'Tobi A.', 'operations sees partial names');
select is((approval_decide('30000000-0000-4000-8000-000000002042', 'approve'))->>'status', 'approved', 'operations completes the 2-of-2');
select throws_like($$select customer_freeze('00000000-0000-4000-8000-000000000420', true)$$, '%Only Compliance%', 'only compliance freezes');
reset role;

select * from finish();
rollback;
