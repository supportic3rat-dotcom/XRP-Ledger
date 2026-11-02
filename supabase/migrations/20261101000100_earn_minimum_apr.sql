-- Earn has a 1% minimum APR on every coin, before the platform fee. The checks make a lower rate impossible to store,
-- so lowering the minimum takes a new migration.

update public.assets set yield_apr_bps = 100 where yield_apr_bps < 100;
update public.yield_positions set apr_bps = 100 where apr_bps < 100;
alter table public.assets add constraint assets_earn_minimum_apr check (yield_apr_bps is null or yield_apr_bps >= 100);
alter table public.yield_positions add constraint yield_positions_minimum_apr check (apr_bps >= 100);

-- Rewards are paid in each coin, so the reserve is per coin: wallets of the platform's own money, read live from the
-- network. A wallet taking customer deposits can't be one, or customers' own funds would count as cover.
alter table public.platform_wallets add column reward_reserve boolean not null default false;

create function public.platform_wallet_set_reserve(p_id uuid, p_reserve boolean)
returns public.platform_wallets language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  w platform_wallets;
begin
  if r is distinct from 'compliance' then raise exception 'Only Compliance can change the Earn reserve.' using errcode = '42501'; end if;
  select * into w from platform_wallets where id = p_id and removed_at is null for update;
  if not found then raise exception 'Wallet not found' using errcode = 'P0002'; end if;
  if p_reserve and (exists (select 1 from asset_networks where deposit_address = w.address)
                    or exists (select 1 from assets where deposit_address = w.address)
                    or exists (select 1 from custody_wallets where address = w.address)) then
    raise exception 'That wallet holds customer funds, so it can’t count as the Earn reserve.' using errcode = '22023';
  end if;
  update platform_wallets set reward_reserve = p_reserve where id = p_id returning * into w;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), r,
    (case when p_reserve then 'Set ' else 'Removed ' end) || w.name || (case when p_reserve then ' as' else ' from' end) || ' the Earn reserve', w.id::text);
  return w;
end $$;

-- 12 months of minimum rewards per coin, after each position's platform fee.
create function public.earn_reserve_needs()
returns table (asset text, allocated_drops bigint, needed_drops bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only.' using errcode = '42501'; end if;
  return query
    select p.asset, sum(p.allocated_drops)::bigint,
           ceil(sum(p.allocated_drops::numeric * 100 * (10000 - p.fee_bps) / 100000000))::bigint
    from yield_positions p where p.allocated_drops > 0 group by p.asset order by p.asset;
end $$;

revoke execute on function public.platform_wallet_set_reserve(uuid, boolean), public.earn_reserve_needs() from anon, public;
grant execute on function public.platform_wallet_set_reserve(uuid, boolean), public.earn_reserve_needs() to authenticated;
