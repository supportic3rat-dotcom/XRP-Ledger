-- Top 50: 32 more coins (CoinGecko market-cap ranking, 2026-10-23), mirroring packages/ledger/src/assets.ts.
-- Skipped from that ranking: tokenized funds and securities, dollar stablecoins and gold tokens other than USDT/USDC,
-- Monero (privacy coin), Canton and Pi (closed networks), and coins priced under $0.0001 (SHIB, PEPE, HTX), which the
-- micro-dollar price precision can't value accurately. All deposits are reported and staff-confirmed; no deposit
-- address is set yet (Compliance sets one per coin in the app's console). Limits target the same USD values as USDT's.

insert into public.assets (id, name, network, decimals, coingecko_id, address_pattern, memo_kind, deposit_mode, min_deposit, min_withdrawal,
  withdrawal_fee, approval_threshold, min_product, min_collateral, daily_limit, yield_apr_bps, collateral, display_decimals, sort) values
  ('ZEC', 'Zcash', 'Zcash (transparent)', 8, 'zcash', '^t[13][1-9A-HJ-NP-Za-km-z]{33}$', null, 'reported', 800000, 2000000, 80000, 200000000, 8000000, 20000000, 4900000000, null, false, 5, 19),
  ('HYPE', 'Hyperliquid', 'Hyperliquid (HyperEVM)', 8, 'hyperliquid', '^0x[0-9a-fA-F]{40}$', null, 'reported', 10000000, 30000000, 1000000, 3200000000, 100000000, 300000000, 77000000000, null, false, 3, 20),
  ('WBT', 'WhiteBIT Coin', 'Ethereum (ERC-20)', 8, 'whitebit', '^0x[0-9a-fA-F]{40}$', null, 'reported', 10000000, 30000000, 4000000, 3200000000, 100000000, 300000000, 76000000000, null, false, 3, 21),
  ('LEO', 'LEO Token', 'Ethereum (ERC-20)', 8, 'leo-token', '^0x[0-9a-fA-F]{40}$', null, 'reported', 100000000, 200000000, 30000000, 28000000000, 1000000000, 3000000000, 660000000000, null, false, 2, 22),
  ('NEAR', 'NEAR Protocol', 'NEAR', 8, 'near', '^([a-z0-9_-]+\.)+near$|^[0-9a-f]{64}$', null, 'reported', 200000000, 400000000, 20000000, 51000000000, 2000000000, 5000000000, 1200000000000, null, false, 2, 23),
  ('RAIN', 'Rain', 'Arbitrum One', 8, 'rain', '^0x[0-9a-fA-F]{40}$', null, 'reported', 100000000000, 200000000000, 10000000000, 30000000000000, 1000000000000, 3000000000000, 710000000000000, null, false, 2, 24),
  ('UNI', 'Uniswap', 'Ethereum (ERC-20)', 8, 'uniswap', '^0x[0-9a-fA-F]{40}$', null, 'reported', 100000000, 300000000, 40000000, 35000000000, 1000000000, 3000000000, 840000000000, null, false, 2, 25),
  ('SUI', 'Sui', 'Sui', 8, 'sui', '^0x[0-9a-fA-F]{64}$', null, 'reported', 1000000000, 2000000000, 100000000, 250000000000, 10000000000, 30000000000, 6000000000000, null, false, 2, 26),
  ('HBAR', 'Hedera', 'Hedera', 8, 'hedera-hashgraph', '^0\.0\.[0-9]{1,10}$', 'memo', 'reported', 10000000000, 30000000000, 1000000000, 3100000000000, 100000000000, 300000000000, 75000000000000, null, false, 2, 27),
  ('TAO', 'Bittensor', 'Bittensor', 8, 'bittensor', '^5[1-9A-HJ-NP-Za-km-z]{47}$', null, 'reported', 4000000, 8000000, 400000, 960000000, 40000000, 100000000, 23000000000, null, false, 4, 28),
  ('CRO', 'Cronos', 'Cronos', 8, 'crypto-com-chain', '^0x[0-9a-fA-F]{40}$', null, 'reported', 20000000000, 40000000000, 2000000000, 4400000000000, 200000000000, 400000000000, 110000000000000, null, false, 2, 29),
  ('ENA', 'Ethena', 'Ethereum (ERC-20)', 8, 'ethena', '^0x[0-9a-fA-F]{40}$', null, 'reported', 5000000000, 10000000000, 1000000000, 1200000000000, 50000000000, 100000000000, 30000000000000, null, false, 2, 30),
  ('QNT', 'Quant', 'Ethereum (ERC-20)', 8, 'quant-network', '^0x[0-9a-fA-F]{40}$', null, 'reported', 5000000, 10000000, 2000000, 1400000000, 50000000, 100000000, 33000000000, null, false, 4, 31),
  ('BTW', 'Bitway', 'BNB Smart Chain (BEP-20)', 8, 'bitway', '^0x[0-9a-fA-F]{40}$', null, 'reported', 600000000, 1000000000, 60000000, 140000000000, 6000000000, 10000000000, 3500000000000, null, false, 2, 32),
  ('OKB', 'OKB', 'Ethereum (ERC-20)', 8, 'okb', '^0x[0-9a-fA-F]{40}$', null, 'reported', 9000000, 20000000, 3000000, 2200000000, 90000000, 200000000, 54000000000, null, false, 4, 33),
  ('AAVE', 'Aave', 'Ethereum (ERC-20)', 8, 'aave', '^0x[0-9a-fA-F]{40}$', null, 'reported', 7000000, 10000000, 2000000, 1700000000, 70000000, 200000000, 41000000000, null, false, 4, 34),
  ('PUMP', 'Pump.fun', 'Solana (SPL)', 6, 'pump-fun', '^[1-9A-HJ-NP-Za-km-z]{32,44}$', null, 'reported', 2000000000, 4000000000, 200000000, 540000000000, 20000000000, 50000000000, 13000000000000, null, false, 2, 35),
  ('ONDO', 'Ondo', 'Ethereum (ERC-20)', 8, 'ondo-finance', '^0x[0-9a-fA-F]{40}$', null, 'reported', 2000000000, 5000000000, 700000000, 580000000000, 20000000000, 60000000000, 14000000000000, null, false, 2, 36),
  ('M', 'MemeCore', 'MemeCore', 8, 'memecore', '^0x[0-9a-fA-F]{40}$', null, 'reported', 1000000000, 2000000000, 100000000, 280000000000, 10000000000, 30000000000, 6700000000000, null, false, 2, 37),
  ('WLD', 'Worldcoin', 'Ethereum (ERC-20)', 8, 'worldcoin-wld', '^0x[0-9a-fA-F]{40}$', null, 'reported', 2000000000, 4000000000, 600000000, 470000000000, 20000000000, 50000000000, 11000000000000, null, false, 2, 38),
  ('ASTER', 'Aster', 'BNB Smart Chain (BEP-20)', 8, 'aster-2', '^0x[0-9a-fA-F]{40}$', null, 'reported', 1000000000, 3000000000, 100000000, 350000000000, 10000000000, 40000000000, 8500000000000, null, false, 2, 39),
  ('MNT', 'Mantle', 'Mantle', 8, 'mantle', '^0x[0-9a-fA-F]{40}$', null, 'reported', 2000000000, 4000000000, 200000000, 470000000000, 20000000000, 50000000000, 11000000000000, null, false, 2, 40),
  ('SKY', 'Sky', 'Ethereum (ERC-20)', 8, 'sky', '^0x[0-9a-fA-F]{40}$', null, 'reported', 10000000000, 30000000000, 4000000000, 3400000000000, 100000000000, 300000000000, 83000000000000, null, false, 2, 41),
  ('WLFI', 'World Liberty Financial', 'Ethereum (ERC-20)', 8, 'world-liberty-financial', '^0x[0-9a-fA-F]{40}$', null, 'reported', 20000000000, 40000000000, 6000000000, 4700000000000, 200000000000, 500000000000, 110000000000000, null, false, 2, 42),
  ('MORPHO', 'Morpho', 'Ethereum (ERC-20)', 8, 'morpho', '^0x[0-9a-fA-F]{40}$', null, 'reported', 400000000, 900000000, 100000000, 110000000000, 4000000000, 10000000000, 2600000000000, null, false, 2, 43),
  ('ICP', 'Internet Computer', 'Internet Computer', 8, 'internet-computer', '^[0-9a-f]{64}$', null, 'reported', 400000000, 700000000, 40000000, 91000000000, 4000000000, 9000000000, 2200000000000, null, false, 2, 44),
  ('BGB', 'Bitget Token', 'Ethereum (ERC-20)', 8, 'bitget-token', '^0x[0-9a-fA-F]{40}$', null, 'reported', 500000000, 1000000000, 200000000, 130000000000, 5000000000, 10000000000, 3200000000000, null, false, 2, 45),
  ('VVV', 'Venice Token', 'Base', 8, 'venice-token', '^0x[0-9a-fA-F]{40}$', null, 'reported', 40000000, 80000000, 4000000, 9600000000, 400000000, 1000000000, 230000000000, null, false, 3, 46),
  ('ETC', 'Ethereum Classic', 'Ethereum Classic', 8, 'ethereum-classic', '^0x[0-9a-fA-F]{40}$', null, 'reported', 100000000, 300000000, 10000000, 32000000000, 1000000000, 3000000000, 760000000000, null, false, 2, 47),
  ('ARB', 'Arbitrum', 'Arbitrum One', 8, 'arbitrum', '^0x[0-9a-fA-F]{40}$', null, 'reported', 6000000000, 10000000000, 600000000, 1400000000000, 60000000000, 100000000000, 33000000000000, null, false, 2, 48),
  ('JST', 'JUST', 'Tron (TRC-20)', 8, 'just', '^T[1-9A-HJ-NP-Za-km-z]{33}$', null, 'reported', 7000000000, 10000000000, 700000000, 1800000000000, 70000000000, 200000000000, 43000000000000, null, false, 2, 49),
  ('GT', 'Gate', 'GateChain', 8, 'gatechain-token', '^0x[0-9a-fA-F]{40}$', null, 'reported', 100000000, 200000000, 10000000, 25000000000, 1000000000, 2000000000, 600000000000, null, false, 3, 50)
on conflict (id) do nothing;
