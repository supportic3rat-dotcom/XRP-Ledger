-- The ledger's overdraft guard now says what the customer needs to know; the account and amount go in the detail.
create or replace function public.post_entry(
  p_kind text, p_reference text, p_transaction uuid, p_created_by text, p_lines jsonb,
  p_reason text default null, p_reverses uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  entry uuid;
  line jsonb;
  acc uuid;
  touched uuid[] := '{}';
  bal bigint;
begin
  insert into journal_entries (kind, reference, transaction_id, created_by, reason, reverses_entry_id)
  values (p_kind, p_reference, p_transaction, p_created_by, p_reason, p_reverses)
  returning id into entry;

  for line in select * from jsonb_array_elements(p_lines) loop
    acc := public.ledger_account(nullif(line->>'customer', '')::uuid, (line->>'kind')::account_kind, coalesce(line->>'asset', 'XRP'));
    perform 1 from ledger_accounts where id = acc for update;
    insert into journal_lines (entry_id, account_id, amount_drops) values (entry, acc, (line->>'amount')::bigint);
    touched := touched || acc;
  end loop;

  for acc in select distinct unnest(touched) loop
    if exists (select 1 from ledger_accounts where id = acc and customer_id is not null) then
      bal := public.account_balance(acc);
      if bal < 0 then
        raise exception 'That’s more than your available balance.' using errcode = '23514', detail = format('Account %s would be %s', acc, bal);
      end if;
    end if;
  end loop;
  return entry;
end $$;
