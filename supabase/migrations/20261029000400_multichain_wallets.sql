-- Outside wallets on every supported network (owner's decision, 2026-10-29), not just the XRP Ledger. Watch-only
-- wallets can be on any of them; self-custody (keys on the phone, sending from the app) is XRP only for now.
-- Balances are read from public data for each asset the network carries, e.g. ETH, USDT, USDC and POL on Ethereum.

alter table public.external_wallets drop constraint if exists external_wallets_address_check;
alter table public.external_wallets add column if not exists network text not null default 'xrp';
alter table public.external_wallets add column if not exists balances jsonb not null default '{}'::jsonb;
alter table public.external_wallets add constraint external_wallets_self_custody_xrp check (access = 'watch' or network = 'xrp');
alter table public.external_wallets add constraint external_wallets_address_shape check (length(address) between 8 and 130);

drop function if exists public.external_wallet_set(uuid, text, text, boolean);
create function public.external_wallet_set(p_customer uuid, p_address text, p_access text, p_add boolean, p_network text default 'xrp')
returns void language plpgsql security definer set search_path = public as $$
declare
  addr text := trim(coalesce(p_address, ''));
begin
  if p_add then
    -- Only networks of coins the platform supports today (a disabled coin may share a network id).
    if not exists (select 1 from asset_networks n join assets a on a.id = n.asset where n.network = p_network and a.enabled) then
      raise exception 'That network isn’t supported.' using errcode = '22023';
    end if;
    if not exists (select 1 from asset_networks n join assets a on a.id = n.asset where n.network = p_network and a.enabled and addr ~ n.address_pattern) then
      raise exception 'That isn’t a valid address on this network.' using errcode = '22023';
    end if;
    if p_access = 'self_custody' and p_network <> 'xrp' then
      raise exception 'Only XRP Ledger wallets can be imported to send from this app for now.' using errcode = '22023';
    end if;
    if exists (select 1 from external_wallets where customer_id = p_customer and network = p_network and address = addr and removed_at is null) then
      update external_wallets set access = p_access where customer_id = p_customer and network = p_network and address = addr and removed_at is null;
    else
      insert into external_wallets (customer_id, address, access, network) values (p_customer, addr, p_access, p_network);
    end if;
  else
    update external_wallets set removed_at = now()
    where customer_id = p_customer and address = addr and (p_network is null or network = p_network) and removed_at is null;
  end if;
end $$;

revoke execute on function public.external_wallet_set from public, anon, authenticated;
