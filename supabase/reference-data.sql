-- Reference data a live project needs (no test users or balances): legal documents and withdrawal limits.
-- Safe to re-run: existing rows are left as they are. Load with: supabase db query --linked -f supabase/reference-data.sql

-- ───────── Legal documents ─────────
insert into public.legal_documents (id, grp, name, current_version, requires_acceptance, change_summary, sections, sort) values
  ('privacy', 'Account', 'Privacy Policy', 'v0.1', true, null,
   '[["What we collect","Identity, contact, device and transaction data — and why each is needed."],["Who we share it with","The service providers we use to run the platform, listed by purpose."],["Your rights","Access, correction and deletion, subject to record-keeping law."]]', 2),
  ('risk', 'Account', 'Digital Asset Risk Disclosure', 'v0.1', true, null,
   '[["Price risk","XRP can lose value quickly, including all of it."],["Custodial risk","You rely on the platform and its providers remaining solvent and available."],["No guarantees","No deposit insurance or guaranteed returns unless stated in a specific product."]]', 3),
  ('custody', 'Custody & payments', 'Custody Agreement', 'v0.1', true, null,
   '[["How assets are held","In platform wallets we control, recorded against your account in our ledger."],["Records and reconciliation","Our internal ledger, how it’s reconciled with the provider, and your statements."],["If something goes wrong","Outages, insolvency and how claims are handled."]]', 4),
  ('deposits', 'Custody & payments', 'Deposit and Withdrawal Policy', 'v0.1', true, null,
   '[["Supported networks","Which assets and networks are accepted, and destination tag rules."],["Review and limits","Why withdrawals are reviewed, approval thresholds and daily limits."],["Mistakes","What happens with wrong networks, missing tags or unsupported tokens."]]', 5),
  ('fees', 'Custody & payments', 'Fees and Charges', 'v0.2', true,
   'The exchange spread is now shown as a single percentage, and the bank payout fee is listed separately.',
   '[["Deposits and withdrawals","Deposits are free; withdrawals cost 0.25 XRP plus the network fee."],["Exchange","Spread and payout fee, shown before you accept a quote."],["Products","Yield platform fee and loan interest and origination fees."]]', 6),
  ('yield', 'Products', 'Yield Product Terms', 'v0.1', true, null,
   '[["How rewards work","Rate source, accrual, confirmation and when rewards are credited."],["Withdrawing","Notice periods and provider-dependent delays."],["Risks","Provider failure and variable rates."]]', 7),
  ('lending', 'Products', 'Lending and Collateral Agreement', 'v0.1', true, null,
   '[["Collateral","Loan-to-value, margin calls and liquidation at 80%."],["Interest and repayment","Rate type, schedule and early repayment."],["Liquidation","How collateral is sold and any shortfall is handled."]]', 8),
  ('complaints', 'Products', 'Complaints and Disputes', 'v0.1', false, null,
   '[["How to complain","Through Help & support, with a reference number."],["Response times","When we acknowledge and resolve complaints."],["Escalation","External bodies you can contact, depending on jurisdiction."]]', 9)
on conflict (id) do nothing;

insert into public.limits (id, label, amount_drops) values
  ('customer_daily', 'Per customer, daily', 25000000000),
  ('auto_sign', 'Per transaction (auto-sign)', 1000000000),
  ('platform_daily', 'Platform outflow, daily', 150000000000)
on conflict (id) do nothing;
