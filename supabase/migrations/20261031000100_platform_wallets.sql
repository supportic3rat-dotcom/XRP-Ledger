-- More wallets for the Custody screen, on any supported network. `custody_wallets` stays the XRP hot/warm/cold set the
-- worker and reconciliation read; these are listed with their live balance and never change where deposits go (that is
-- each coin's deposit address).

create table public.platform_wallets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  network text not null,
  address text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create unique index platform_wallets_active on public.platform_wallets (network, address) where removed_at is null;
alter table public.platform_wallets enable row level security;
create policy platform_wallets_staff on public.platform_wallets for select to authenticated using (public.is_staff());

create function public.platform_wallet_add(p_name text, p_network text, p_address text)
returns public.platform_wallets language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  who text := coalesce(public.staff_name(), 'Staff');
  nm text := trim(coalesce(p_name, ''));
  addr text := trim(coalesce(p_address, ''));
  n asset_networks;
  w platform_wallets;
begin
  if r is distinct from 'compliance' then raise exception 'Only Compliance can add wallets.' using errcode = '42501'; end if;
  if length(nm) not between 1 and 60 then raise exception 'Give the wallet a name of up to 60 characters.' using errcode = '22023'; end if;
  select * into n from asset_networks where network = p_network order by sort limit 1;
  if not found then raise exception 'That network isn’t supported.' using errcode = '22023'; end if;
  if addr !~ n.address_pattern then raise exception 'That isn’t a valid % address.', n.name using errcode = '22023'; end if;
  if exists (select 1 from platform_wallets where network = p_network and address = addr and removed_at is null) then
    raise exception 'That wallet is already added.' using errcode = '22023';
  end if;
  insert into platform_wallets (name, network, address, created_by) values (nm, p_network, addr, auth.uid()) returning * into w;
  perform public.audit('staff', auth.uid()::text, who, r, 'Added wallet ' || nm || ' on ' || n.name || ' · ' || left(addr, 10) || '…', w.id::text);
  return w;
end $$;

create function public.platform_wallet_remove(p_id uuid)
returns public.platform_wallets language plpgsql security definer set search_path = public as $$
declare
  r text := public.app_role();
  w platform_wallets;
begin
  if r is distinct from 'compliance' then raise exception 'Only Compliance can remove wallets.' using errcode = '42501'; end if;
  update platform_wallets set removed_at = now() where id = p_id and removed_at is null returning * into w;
  if not found then raise exception 'Wallet not found' using errcode = 'P0002'; end if;
  perform public.audit('staff', auth.uid()::text, coalesce(public.staff_name(), 'Staff'), r,
    'Removed wallet ' || w.name || ' · ' || left(w.address, 10) || '…', w.id::text);
  return w;
end $$;

revoke execute on function public.platform_wallet_add(text, text, text), public.platform_wallet_remove(uuid) from anon, public;
grant execute on function public.platform_wallet_add(text, text, text), public.platform_wallet_remove(uuid) to authenticated;
