-- Seed data matching the designs. Test credentials (local/staging only):
--   customer  brendan@example.com      / Prototype-Pass-2026   (mobile sample customer, ACC-PROTO-0042)
--   customer  tobi.adeyemi@example.com / Customer-Pass-2026    (admin sample customer, CUS-0042)
--   operations a.bello@ops.example.com / Ops-Pass-2026
--   compliance j.duru@ops.example.com  / Compliance-Pass-2026
--   auditor   auditor@ops.example.com  / Auditor-Pass-2026

set session_replication_role = replica; -- fixed historical timestamps; invariants re-checked at the end

-- ───────── Auth users ─────────
create or replace function pg_temp.mk_user(p_id uuid, p_email text, p_password text) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, crypt(p_password, gen_salt('bf')),
          now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email), 'email', now(), now(), now());
$$;

select pg_temp.mk_user('00000000-0000-4000-8000-000000000042', 'brendan@example.com', 'Prototype-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-8000-000000000420', 'tobi.adeyemi@example.com', 'Customer-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-8000-000000000187', 'hauwa.b@example.com', 'Customer-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-8000-000000000311', 'ngozi.eze@example.com', 'Customer-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-8000-000000000098', 'emeka.obi@example.com', 'Customer-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-8000-000000000233', 'funke.ade@example.com', 'Customer-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-9000-00000000a001', 'a.bello@ops.example.com', 'Ops-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-9000-00000000a002', 'm.okon@ops.example.com', 'Ops-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-9000-00000000c001', 'j.duru@ops.example.com', 'Compliance-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-9000-00000000c002', 'k.musa@ops.example.com', 'Compliance-Pass-2026');
select pg_temp.mk_user('00000000-0000-4000-9000-00000000d001', 'auditor@ops.example.com', 'Auditor-Pass-2026');

insert into public.staff_roles (staff_id, display_name, role) values
  ('00000000-0000-4000-9000-00000000a001', 'A. Bello', 'operations'),
  ('00000000-0000-4000-9000-00000000a002', 'M. Okon', 'operations'),
  ('00000000-0000-4000-9000-00000000c001', 'J. Duru', 'compliance'),
  ('00000000-0000-4000-9000-00000000c002', 'K. Musa', 'compliance'),
  ('00000000-0000-4000-9000-00000000d001', 'Read-only auditor', 'auditor');

-- ───────── Customers ─────────
insert into public.customers (id, account_ref, full_name, display_name, email, phone, dob, country, kyc_status, kyc_level,
                              risk_rating, destination_tag, allowlist_enabled, password_changed_at, created_at) values
  ('00000000-0000-4000-8000-000000000042', 'ACC-PROTO-0042', 'Brendan Mebuge', 'Brendan M.', 'brendan@example.com', '+234 803 555 0100',
   '1990-06-05', 'Nigeria', 'verified', 2, 'Low', 48201937, false, '2026-07-20 09:00+01', '2026-09-02 10:14+01'),
  ('00000000-0000-4000-8000-000000000420', 'CUS-0042', 'Tobi Adeyemi', 'Tobi A.', 'tobi.adeyemi@example.com', '+234 803 555 4821',
   '1991-04-12', 'Nigeria', 'verified', 2, 'Low', 48201942, false, '2026-09-02 09:00+01', '2026-09-02 10:14+01'),
  ('00000000-0000-4000-8000-000000000187', 'CUS-0187', 'Hauwa Bello', 'Hauwa B.', 'hauwa.b@example.com', '+234 806 555 1290',
   '1988-11-30', 'Nigeria', 'verified', 2, 'Low', 48201938, true, '2026-08-14 09:00+01', '2026-08-14 09:00+01'),
  ('00000000-0000-4000-8000-000000000311', 'CUS-0311', 'Ngozi Eze', 'Ngozi E.', 'ngozi.eze@example.com', '+234 809 555 7714',
   '1995-02-08', 'Nigeria', 'verified', 1, 'Low', 48201939, false, '2026-10-01 09:00+01', '2026-10-01 09:00+01'),
  ('00000000-0000-4000-8000-000000000098', 'CUS-0098', 'Emeka Obi', 'Emeka O.', 'emeka.obi@example.com', '+44 7700 900312',
   '1984-07-21', 'United Kingdom', 'verified', 2, 'Medium', 48201940, false, '2026-07-30 09:00+01', '2026-07-30 09:00+01'),
  ('00000000-0000-4000-8000-000000000233', 'CUS-0233', 'Funke Ade', 'Funke A.', 'funke.ade@example.com', '+234 802 555 0045',
   '1999-09-17', 'Nigeria', 'in_progress', 0, 'Not rated', 48201941, false, '2026-10-15 09:00+01', '2026-10-15 09:00+01');

-- ───────── Legal documents ─────────
insert into public.legal_documents (id, grp, name, current_version, requires_acceptance, change_summary, sections, sort) values
  ('tos', 'Account', 'Terms of Service', 'v0.1', true, null,
   '[["1. About these Terms", "These Terms of Service (the “Terms”) form a binding agreement between you and [Company name], a company registered in [Jurisdiction] under number [Registration number], with its registered office at [Registered address] (“we”, “us”, “our”). They govern your use of the XRP Ledger app, website and related services (the “Services”).\n\nThese Terms apply together with our Privacy Policy, Digital Asset Risk Disclosure, Custody Agreement, Deposit and Withdrawal Policy, Fees and Charges, and any product terms you accept (for example the Yield Product Terms or the Lending and Collateral Agreement). If a product’s terms conflict with these Terms, the product terms apply to that product.\n\nBy creating an account or using the Services you confirm that you have read, understood and accept these Terms. If you do not agree, do not use the Services."], ["2. Eligibility", "To open an account you must: (a) be at least 18 years old and have full legal capacity; (b) be resident in a country where we offer the Services; (c) not be a person subject to sanctions, or resident in a sanctioned or restricted territory; and (d) open the account for yourself, not on behalf of anyone else. You may hold only one personal account. We may refuse an application at our discretion, and we are not required to give a reason where the law prevents us from doing so."], ["3. Identity verification", "We are required by law to verify who you are before you can deposit, earn or borrow, and to keep that information up to date. You agree to provide accurate, complete information and documents when asked, including during periodic reviews. We use [KYC provider] to carry out these checks. We may limit, suspend or close your account if you do not complete verification or if information you provided is false or out of date."], ["4. Your account and security", "You are responsible for keeping your sign-in details, devices and two-factor authentication methods secure, and for all activity on your account that happens with them. Tell us immediately through Help & support if you believe your account has been accessed without your permission.\n\nYour custodial account has no recovery phrase. We will never ask for your password, one-time codes or the recovery phrase of any wallet, by phone, email, chat or in the app. Anyone who asks for them is attempting fraud, and you should report it to us."], ["5. Custody of your assets", "Digital assets you deposit are held on your behalf through our custody provider, [Custody provider], in accounts segregated from our own corporate assets. Private keys are generated and kept within the custody provider’s security environment and are never stored on your device.\n\nYour balance in the app reflects our internal ledger of what we hold for you, which we reconcile against the custody provider’s records daily. Assets are not deposits with a bank and are not covered by any deposit-guarantee or investor-compensation scheme unless we expressly say otherwise. Full details are in the Custody Agreement."], ["6. Deposits", "Each account is assigned a deposit address and a unique destination tag. Deposits must be sent on the supported network, to the address shown, with your destination tag. A deposit is credited to your available balance once it has been validated on the ledger and passed our screening checks. Deposits sent to the wrong network, without the correct tag, or in an unsupported asset may be delayed, may incur a recovery fee, or may be unrecoverable."], ["7. Withdrawals", "You may withdraw available assets to an external address you control. Withdrawals are reviewed before they are sent, may be subject to daily limits and address allowlisting, and are not instant. We may delay or refuse a withdrawal where we reasonably need to verify it, where the law requires it, or where we suspect fraud. Once a withdrawal has been broadcast to the ledger it cannot be reversed, so you are responsible for checking the address and destination tag."], ["8. Exchange", "Where we offer conversion between digital assets and fiat currency, you will see the rate, spread and any fees before you accept a quote. Quotes are valid for the time shown. An accepted exchange is final once completed, and payouts are made only to a verified bank account in your own name."], ["9. Yield products", "You may choose to allocate assets to yield products offered through third-party providers. Rates are set by the provider, are variable unless stated otherwise, and are not guaranteed. Any figures shown in the app before rewards are confirmed, including live accrual counters and projections, are estimates only. Rewards are credited only once confirmed by the provider, after our platform fee. Allocated assets are exposed to the provider’s risk, including its failure. The Yield Product Terms apply."], ["10. Borrowing", "Where available, you may borrow against digital assets you hold with us as collateral. Before you apply you will see the loan-to-value (LTV) ratio, interest rate, fees, margin-call level and liquidation level. If the value of your collateral falls so that your LTV reaches the liquidation level, we may sell some or all of your collateral without further notice to repay the loan, and you remain liable for any shortfall. The Lending and Collateral Agreement applies."], ["11. Fees", "Our fees are set out in Fees and Charges and are shown in the app before you confirm a transaction. We may deduct fees from your balance. We will give you at least 30 days’ notice of any increase to an existing fee, unless the change is required by law or reflects network fees outside our control."], ["12. Prohibited use", "You must not use the Services: to break any law or sanctions; to launder money or finance terrorism; for fraud, market manipulation or to deceive others; with funds that are proceeds of crime; on behalf of another person without our consent; to interfere with, reverse-engineer or attack the Services; or by creating accounts with false or stolen identities. We may report suspicious activity to the relevant authorities without telling you."], ["13. Monitoring and records", "To protect customers and meet our legal obligations, we record and monitor account activity, including sign-ins, device and approximate location (country and city derived from IP address), changes to your details, and transactions. Authorised staff can view this information under strict access controls, and every access is logged. We keep records for the periods required by law. Our Privacy Policy explains how we use and protect your information."], ["14. Suspension and restrictions", "We may suspend, restrict or freeze your account, or any transaction, where: we are required to by law or a competent authority; we reasonably suspect fraud, unauthorised access or a breach of these Terms; you have not completed verification; or there is a dispute about ownership of the assets. Where the law allows, we will tell you and explain what you need to do."], ["15. Closing your account", "You may close your account at any time through Help & support, after repaying any outstanding loans and withdrawing your assets. We may close your account on 60 days’ notice, or immediately in the circumstances described in section 14. When an account is closed we will return remaining assets to a verified external address or bank account in your name, less any amounts you owe us, unless the law prevents us from doing so."], ["16. Risks", "Digital assets are volatile and can lose some or all of their value quickly. Past performance and estimated returns are not a guide to future results. You rely on us and our providers remaining solvent, secure and available, and on the underlying networks operating as expected. Please read the Digital Asset Risk Disclosure before depositing. Nothing in the Services is investment, legal or tax advice, and you are responsible for any taxes due on your activity."], ["17. Our liability", "We will provide the Services with reasonable skill and care. We are not liable for: losses caused by your breach of these Terms or failure to keep your account secure; changes in the market value of digital assets; delays or failures of third-party networks or providers outside our reasonable control; or indirect or consequential loss. Our total liability to you in connection with the Services is limited to the greater of the fees you paid us in the 12 months before the claim and [Liability cap amount]. Nothing in these Terms limits liability for fraud, death or personal injury caused by negligence, or any liability that cannot be limited by law."], ["18. Intellectual property", "The Services, including the software, design and content, belong to us or our licensors. We grant you a personal, non-transferable licence to use the app for your own account while these Terms apply. XRP Ledger is used descriptively; we are not affiliated with Ripple Labs or the XRP Ledger Foundation."], ["19. Changes to these Terms", "We may update these Terms to reflect changes in the law, our providers or the Services. We will give you at least 30 days’ notice of material changes in the app or by email, and ask you to accept them where required. If you do not accept a change, you may close your account before it takes effect without charge."], ["20. Complaints, governing law and contact", "If you are unhappy with the Services, please contact us through Help & support; our Complaints and Disputes policy explains how we handle complaints and when you may escalate to an external body. These Terms are governed by the laws of [Governing law], and the courts of [Jurisdiction] have jurisdiction, without affecting any mandatory consumer rights you have where you live.\n\nContact: [Company name], [Registered address], [Support email]."]]', 1),
  ('privacy', 'Account', 'Privacy Policy', 'v0.1', true, null,
   '[["What we collect","Identity, contact, device and transaction data — and why each is needed."],["Who we share it with","[KYC provider], [Custody provider] and others, listed by purpose."],["Your rights","Access, correction and deletion, subject to record-keeping law."]]', 2),
  ('risk', 'Account', 'Digital Asset Risk Disclosure', 'v0.1', true, null,
   '[["Price risk","XRP can lose value quickly, including all of it."],["Custodial risk","You rely on the platform and its providers remaining solvent and available."],["No guarantees","No deposit insurance or guaranteed returns unless stated in a specific product."]]', 3),
  ('custody', 'Custody & payments', 'Custody Agreement', 'v0.1', true, null,
   '[["How assets are held","Through [Custody provider]; keys stay in the provider’s security boundary."],["Records and reconciliation","Our internal ledger, how it’s reconciled with the provider, and your statements."],["If something goes wrong","Outages, insolvency and how claims are handled."]]', 4),
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
   '[["How to complain","Through Help & support, with a reference number."],["Response times","When we acknowledge and resolve complaints."],["Escalation","External bodies you can contact, depending on jurisdiction."]]', 9);

insert into public.consents (id, customer_id, document, version, accepted_at, surface) values
  ('CNS-PROTO-0001', '00000000-0000-4000-8000-000000000042', 'tos', 'v0.1', '2026-09-02 10:14+01', 'Sign-up'),
  ('CNS-PROTO-0002', '00000000-0000-4000-8000-000000000042', 'privacy', 'v0.1', '2026-09-02 10:14+01', 'Sign-up'),
  ('CNS-PROTO-0003', '00000000-0000-4000-8000-000000000042', 'risk', 'v0.1', '2026-09-02 10:14+01', 'Sign-up'),
  ('CNS-PROTO-0004', '00000000-0000-4000-8000-000000000042', 'custody', 'v0.1', '2026-09-02 10:20+01', 'Account setup'),
  ('CNS-PROTO-0005', '00000000-0000-4000-8000-000000000042', 'deposits', 'v0.1', '2026-09-02 10:20+01', 'Account setup'),
  ('CNS-PROTO-0006', '00000000-0000-4000-8000-000000000042', 'fees', 'v0.1', '2026-09-02 10:20+01', 'Account setup'),
  ('CNS-PROTO-0007', '00000000-0000-4000-8000-000000000042', 'yield', 'v0.1', '2026-09-16 08:02+01', 'Earn · XRP Flexible'),
  ('CNS-PROTO-0008', '00000000-0000-4000-8000-000000000042', 'lending', 'v0.1', '2026-09-18 17:40+01', 'Borrow · LN-PROTO-0007');

-- ───────── Ledger helpers for historical seed rows ─────────
create or replace function pg_temp.entry(p_kind text, p_ref text, p_tx uuid, p_at timestamptz, p_lines jsonb) returns void language plpgsql as $$
declare e uuid; l jsonb;
begin
  insert into public.journal_entries (kind, reference, transaction_id, created_by, created_at) values (p_kind, p_ref, p_tx, 'seed', p_at) returning id into e;
  for l in select * from jsonb_array_elements(p_lines) loop
    insert into public.journal_lines (entry_id, account_id, amount_drops)
    values (e, public.ledger_account(nullif(l->>0, '')::uuid, (l->>1)::public.account_kind), (l->>2)::bigint);
  end loop;
end $$;

create or replace function pg_temp.tx(p_id uuid, p_ref text, p_customer uuid, p_kind public.tx_kind, p_status text, p_drops bigint,
  p_at timestamptz, p_fields jsonb, p_events jsonb) returns void language plpgsql as $$
declare ev jsonb; prev text := null;
begin
  insert into public.transactions (id, ref, customer_id, kind, status, amount_drops, amount_cents, fee_drops, network_fee_drops, counterparty,
                                   destination_tag, ledger_hash, ledger_index, meta, created_at, updated_at)
  values (p_id, p_ref, p_customer, p_kind, p_status, p_drops, (p_fields->>'cents')::bigint, coalesce((p_fields->>'fee')::bigint, 0),
          coalesce((p_fields->>'net_fee')::bigint, 0), p_fields->>'counterparty', (p_fields->>'tag')::bigint, p_fields->>'hash',
          (p_fields->>'index')::bigint, coalesce(p_fields->'meta', '{}'), p_at, p_at);
  for ev in select * from jsonb_array_elements(p_events) loop
    insert into public.transaction_events (transaction_id, from_status, to_status, actor, note, at)
    values (p_id, prev, ev->>0, ev->>2, ev->>3, (ev->>1)::timestamptz);
    prev := ev->>0;
  end loop;
end $$;

-- Brendan (ACC-PROTO-0042): opening balance so that the posted history ends at the design's figures.
select pg_temp.entry('opening', 'OPEN-ACC-PROTO-0042', null, '2026-09-02 10:30+01',
  '[["", "omnibus", "4718210000"], ["00000000-0000-4000-8000-000000000042", "available", "-4718210000"]]');

-- DEP-PROTO-1650 · +2,000.00 credited Sep 21
select pg_temp.tx('10000000-0000-4000-8000-000000001650', 'DEP-PROTO-1650', '00000000-0000-4000-8000-000000000042', 'deposit', 'credited',
  2000000000, '2026-09-21 08:47+01', '{"counterparty":"rExtXk3PaKcV9tYwZ2hNbQb7mproto9","tag":48201937,"hash":"9A1DPROTO","meta":{"from_label":"rExt…proto9 (your connected wallet)"}}',
  '[["detected","2026-09-21 08:47+01","Monitor"],["validated","2026-09-21 08:47+01","Monitor"],["screened","2026-09-21 08:49+01","[Screening provider]"],["credited","2026-09-21 08:49+01","System"]]');
select pg_temp.entry('deposit:credited', 'DEP-PROTO-1650', '10000000-0000-4000-8000-000000001650', '2026-09-21 08:49+01',
  '[["", "omnibus", "2000000000"], ["00000000-0000-4000-8000-000000000042", "available", "-2000000000"]]');

-- XRP Flexible allocation · 1,500.00 since Sep 16
select pg_temp.tx('10000000-0000-4000-8000-000000000021', 'YLD-PROTO-0021', '00000000-0000-4000-8000-000000000042', 'yield_allocate', 'confirmed',
  1500000000, '2026-09-16 08:02+01', '{"meta":{"product":"XRP Flexible"}}',
  '[["requested","2026-09-16 08:02+01","Customer"],["sent","2026-09-16 08:03+01","System"],["confirmed","2026-09-16 11:20+01","[Yield provider]"]]');
select pg_temp.entry('yield_allocate:requested', 'YLD-PROTO-0021', '10000000-0000-4000-8000-000000000021', '2026-09-16 08:02+01',
  '[["00000000-0000-4000-8000-000000000042", "available", "1500000000"], ["00000000-0000-4000-8000-000000000042", "pending_yield", "-1500000000"]]');
select pg_temp.entry('yield_allocate:confirmed', 'YLD-PROTO-0021', '10000000-0000-4000-8000-000000000021', '2026-09-16 11:20+01',
  '[["00000000-0000-4000-8000-000000000042", "pending_yield", "1500000000"], ["00000000-0000-4000-8000-000000000042", "yield", "-1500000000"]]');
insert into public.yield_positions (customer_id, product, allocated_drops, apr_bps, fee_bps, credited_drops, confirmed_unpaid_drops,
                                    estimated_accrued_drops, since, rate_updated_at)
values ('00000000-0000-4000-8000-000000000042', 'xrp_flexible', 1500000000, 300, 1000, 1890000, 0, 1970000, '2026-09-16 08:02+01', '2026-10-19 09:00+01');

-- LN-PROTO-0007 · $600 funded Sep 19, 750 XRP collateral
insert into public.loans (id, ref, customer_id, principal_usd_cents, interest_usd_cents, apr_bps, collateral_drops, origination_fee_cents,
                          status, funded_at, next_interest_due, provider_ref, created_at)
values ('20000000-0000-4000-8000-000000000007', 'LN-PROTO-0007', '00000000-0000-4000-8000-000000000042', 60000, 493, 1000, 750000000, 600,
        'active', '2026-09-19 14:30+01', '2026-11-19', '[Lending provider]', '2026-09-18 17:40+01');
select pg_temp.tx('10000000-0000-4000-8000-000000000007', 'LN-PROTO-0007', '00000000-0000-4000-8000-000000000042', 'loan', 'active',
  750000000, '2026-09-19 14:30+01', '{"cents":60000,"meta":{"starting_ltv":"33.6%","paid_to":"[Bank account •••• 0000]"}}',
  '[["applied","2026-09-18 17:40+01","Customer"],["approved","2026-09-19 10:05+01","K. Musa (Compliance)"],["collateral_locked","2026-09-19 10:06+01","System"],["funded","2026-09-19 14:30+01","[Lending provider]"],["active","2026-09-19 14:30+01","System"]]');
update public.transactions set loan_id = '20000000-0000-4000-8000-000000000007' where id = '10000000-0000-4000-8000-000000000007';
select pg_temp.entry('loan:collateral_locked', 'LN-PROTO-0007', '10000000-0000-4000-8000-000000000007', '2026-09-19 10:06+01',
  '[["00000000-0000-4000-8000-000000000042", "available", "750000000"], ["00000000-0000-4000-8000-000000000042", "collateral", "-750000000"]]');

-- YLD-PROTO-0098 · reward 2.10 gross, 0.21 fee, 1.89 credited Oct 3
select pg_temp.tx('10000000-0000-4000-8000-000000000098', 'YLD-PROTO-0098', '00000000-0000-4000-8000-000000000042', 'yield_reward', 'credited',
  2100000, '2026-10-03 09:00+01', '{"fee":210000,"meta":{"product":"XRP Flexible","period":"Sep 16 – Oct 3"}}',
  '[["statement_received","2026-10-03 00:02+01","[Yield provider]"],["matched","2026-10-03 08:12+01","System"],["credited","2026-10-03 09:00+01","System"]]');
select pg_temp.entry('yield_reward:credited', 'YLD-PROTO-0098', '10000000-0000-4000-8000-000000000098', '2026-10-03 09:00+01',
  '[["", "provider_receivable", "2100000"], ["00000000-0000-4000-8000-000000000042", "available", "-1890000"], ["", "fee_revenue", "-210000"]]');

-- EX-PROTO-0301 · rejected Oct 9 (nothing reserved)
select pg_temp.tx('10000000-0000-4000-8000-000000000301', 'EX-PROTO-0301', '00000000-0000-4000-8000-000000000042', 'exchange', 'rejected',
  500000000, '2026-10-09 10:15+01', '{"meta":{"reason":"Payout account not yet verified","indicative_cents":"117504"}}',
  '[["requested","2026-10-09 10:15+01","Customer"],["rejected","2026-10-09 11:02+01","A. Bello (Operations)","Payout account not yet verified"]]');

-- WD-PROTO-1988 · 300.00 incl. 0.25 fee (fees are deducted from the amount), completed Oct 12
select pg_temp.tx('10000000-0000-4000-8000-000000001988', 'WD-PROTO-1988', '00000000-0000-4000-8000-000000000042', 'withdrawal', 'validated',
  300000000, '2026-10-12 15:21+01', '{"fee":250000,"net_fee":12,"counterparty":"rRecipXk3PaKcV9tYwZ2hNproto7Hd","tag":10293847,"hash":"3F9CPROTO","index":92301447}',
  '[["requested","2026-10-12 15:21+01","Customer"],["in_review","2026-10-12 15:40+01","System"],["approved","2026-10-12 15:52+01","A. Bello (Operations)"],["submitted","2026-10-12 16:02+01","[Custody provider]"],["validated","2026-10-12 16:08+01","XRPL worker"]]');
select pg_temp.entry('withdrawal:requested', 'WD-PROTO-1988', '10000000-0000-4000-8000-000000001988', '2026-10-12 15:21+01',
  '[["00000000-0000-4000-8000-000000000042", "available", "300000000"], ["00000000-0000-4000-8000-000000000042", "reserved", "-300000000"]]');
select pg_temp.entry('withdrawal:validated', 'WD-PROTO-1988', '10000000-0000-4000-8000-000000001988', '2026-10-12 16:08+01',
  '[["00000000-0000-4000-8000-000000000042", "reserved", "300000000"], ["", "omnibus", "-299750000"], ["", "fee_revenue", "-250000"]]');

-- DEP-PROTO-2041 · 1,250.00 detected today, not yet validated (no journal until credited)
select pg_temp.tx('10000000-0000-4000-8000-000000002041', 'DEP-PROTO-2041', '00000000-0000-4000-8000-000000000042', 'deposit', 'detected',
  1250000000, '2026-10-19 11:42+01', '{"counterparty":"rSendrXk3PaKcV9tYwZ2hNproto9Qa","tag":48201937}',
  '[["detected","2026-10-19 11:42+01","Monitor"]]');

-- Security, devices, allowlist, notifications, support for Brendan
insert into public.allowlist_addresses (customer_id, label, address, tag, active_from, created_at) values
  ('00000000-0000-4000-8000-000000000042', 'Hardware wallet', 'rHwProtoWa11et9xQb7mKcV9tYwZ2A', null, '2026-09-10 09:00+01', '2026-09-09 09:00+01'),
  ('00000000-0000-4000-8000-000000000042', 'Exchange account', 'rExchProtoDeposit4xQb7mKcV9tY', 10293847, now() + interval '6 hours', now() - interval '18 hours');
insert into public.devices (customer_id, name, kind, location, last_active_at) values
  ('00000000-0000-4000-8000-000000000042', 'iPhone 15 · XRP Ledger app', 'phone', 'Lagos', now()),
  ('00000000-0000-4000-8000-000000000042', 'Chrome on macOS', 'laptop', 'Lagos', '2026-10-19 09:14+01');
insert into public.security_events (customer_id, title, meta, created_at) values
  ('00000000-0000-4000-8000-000000000042', 'New sign-in · Chrome on macOS', 'Today 09:14 · Lagos', '2026-10-19 09:14+01'),
  ('00000000-0000-4000-8000-000000000042', 'Allowlist address added', 'Oct 18 · Exchange account', '2026-10-18 12:00+01'),
  ('00000000-0000-4000-8000-000000000042', 'Two-factor turned on', 'Sep 2 · iPhone 15', '2026-09-02 10:25+01'),
  ('00000000-0000-4000-8000-000000000042', 'Account created', 'Sep 2', '2026-09-02 10:14+01');
insert into public.auth_backup_codes (user_id, code_hash, used_at)
select '00000000-0000-4000-8000-000000000042', crypt(c, gen_salt('bf')), case when c in ('Y9EF-5QAS', 'B8ND-2XWR') then now() end
from unnest(array['4K7Q-9MXD', 'T2PZ-H8WN', 'R6CV-3JLB', 'Y9EF-5QAS', 'M3GH-7UTK', 'B8ND-2XWR', 'P5ZL-6CYJ', 'W4QS-1HVE']) as c;
insert into public.external_wallets (customer_id, address, access) values
  ('00000000-0000-4000-8000-000000000042', 'rExtXk3PaKcV9tYwZ2hNbQb7mproto9', 'watch');
insert into public.notifications (customer_id, type, tone, icon, title, body, link, read_at, created_at) values
  ('00000000-0000-4000-8000-000000000042', 'tx', 'warn', 'recv', 'Deposit detected', '1,250.00 XRP is waiting for ledger validation. It’s not in your balance yet.', '/', null, '2026-10-19 11:42+01'),
  ('00000000-0000-4000-8000-000000000042', 'security', '', 'shield', 'New sign-in', 'Chrome on macOS · Lagos. Not you? Revoke the session and change your password.', '/security', null, '2026-10-19 09:14+01'),
  ('00000000-0000-4000-8000-000000000042', 'tx', '', 'clock', 'Interest due soon', 'Your loan LN-PROTO-0007 has $4.93 interest due on Nov 19.', '/loan/manage', '2026-10-18 12:00+01', '2026-10-18 09:00+01'),
  ('00000000-0000-4000-8000-000000000042', 'tx', 'bad', 'ex', 'Exchange request rejected', 'EX-PROTO-0301 was rejected: payout account not yet verified. No XRP was reserved.', '/', '2026-10-09 12:00+01', '2026-10-09 11:02+01'),
  ('00000000-0000-4000-8000-000000000042', 'tx', 'ok', 'coin', 'Yield reward credited', '1.89 XRP from XRP Flexible is now in your available balance.', '/earn', '2026-10-03 12:00+01', '2026-10-03 09:00+01'),
  ('00000000-0000-4000-8000-000000000042', 'security', 'warn', 'alert', 'Collateral alert settings', 'We’ll alert you if your loan’s LTV passes 55%, and again at the 65% margin call.', '/borrow', '2026-09-19 15:00+01', '2026-09-19 14:30+01'),
  ('00000000-0000-4000-8000-000000000042', 'account', '', 'doc', 'Terms updated', 'Fees and Charges draft v0.2 is available to review.', '/legal', '2026-09-02 12:00+01', '2026-09-02 10:00+01');
insert into public.support_tickets (ref, customer_id, topic, subject, status, created_at) values
  ('SUP-0921', '00000000-0000-4000-8000-000000000311', 'Deposit', 'Deposit sent without destination tag', 'waiting_on_us', '2026-10-19 12:05+01');
insert into public.ticket_messages (ticket_ref, author, body, created_at) values
  ('SUP-0921', 'customer', 'I sent 500 XRP from my exchange and forgot the tag. Transaction attached.', '2026-10-19 12:05+01'),
  ('SUP-0921', 'staff', 'Thanks — we’ve found the deposit and it’s held safely. Our operations team is confirming it’s yours; we’ll update you here.', '2026-10-19 12:10+01');

-- ───────── Other customers (admin queue samples) ─────────
select pg_temp.entry('opening', 'OPEN-CUS-0187', null, '2026-08-14 09:30+01', '[["", "omnibus", "1000000000"], ["00000000-0000-4000-8000-000000000187", "available", "-1000000000"]]');
select pg_temp.entry('opening', 'OPEN-CUS-0311', null, '2026-10-01 09:30+01', '[["", "omnibus", "2310000000"], ["00000000-0000-4000-8000-000000000311", "available", "-2310000000"]]');
select pg_temp.entry('opening', 'OPEN-CUS-0098', null, '2026-07-30 09:30+01', '[["", "omnibus", "2000000000"], ["00000000-0000-4000-8000-000000000098", "available", "-2000000000"]]');
select pg_temp.entry('opening', 'OPEN-CUS-0233', null, '2026-10-15 09:30+01', '[["", "omnibus", "420000000"], ["00000000-0000-4000-8000-000000000233", "available", "-420000000"]]');

-- WD-PROTO-2042 · 1,250 by CUS-0042 awaiting 2 of 2 (J. Duru approved 1 of 2)
select pg_temp.entry('opening', 'OPEN-CUS-0042', null, '2026-09-02 10:30+01', '[["", "omnibus", "7670100000"], ["00000000-0000-4000-8000-000000000420", "available", "-5420100000"], ["00000000-0000-4000-8000-000000000420", "yield", "-1500000000"], ["00000000-0000-4000-8000-000000000420", "collateral", "-750000000"]]');
select pg_temp.tx('10000000-0000-4000-8000-000000002042', 'WD-PROTO-2042', '00000000-0000-4000-8000-000000000420', 'withdrawal', 'in_review',
  1250000000, '2026-10-19 12:30+01', '{"fee":250000,"net_fee":12,"counterparty":"rProtoRecipient4xQb7mKcV9tYwZ2hN","tag":10293847}',
  '[["requested","2026-10-19 12:30+01","Customer","2FA verified"],["in_review","2026-10-19 12:30+01","System"]]');
select pg_temp.entry('withdrawal:requested', 'WD-PROTO-2042', '10000000-0000-4000-8000-000000002042', '2026-10-19 12:30+01',
  '[["00000000-0000-4000-8000-000000000420", "available", "1250000000"], ["00000000-0000-4000-8000-000000000420", "reserved", "-1250000000"]]');
insert into public.approvals (id, transaction_id, required, requires_compliance, requested_by, checks, created_at) values
  ('30000000-0000-4000-8000-000000002042', '10000000-0000-4000-8000-000000002042', 2, true, '00000000-0000-4000-8000-000000000420',
   '[["Balance reserved","Ledger hold posted at 12:30","ok"],["Destination screening","[Screening provider]: low risk","ok"],["Within daily limit","1,250 of 25,000 XRP","ok"],["2FA confirmed by customer","Authenticator, 12:30","ok"],["New destination","First withdrawal to this address","warn"]]',
   '2026-10-19 12:30+01');
insert into public.approval_decisions (approval_id, staff_id, role, decision, at) values
  ('30000000-0000-4000-8000-000000002042', '00000000-0000-4000-9000-00000000c001', 'compliance', 'approve', '2026-10-19 12:41+01');

-- WD-PROTO-2043 · 80 by CUS-0187 to an allowlisted address
select pg_temp.tx('10000000-0000-4000-8000-000000002043', 'WD-PROTO-2043', '00000000-0000-4000-8000-000000000187', 'withdrawal', 'in_review',
  80000000, '2026-10-19 12:44+01', '{"fee":250000,"counterparty":"rHauwaSavedAddress9xQb7mKcV9tY"}',
  '[["requested","2026-10-19 12:44+01","Customer","2FA verified"],["in_review","2026-10-19 12:44+01","System"]]');
select pg_temp.entry('withdrawal:requested', 'WD-PROTO-2043', '10000000-0000-4000-8000-000000002043', '2026-10-19 12:44+01',
  '[["00000000-0000-4000-8000-000000000187", "available", "80000000"], ["00000000-0000-4000-8000-000000000187", "reserved", "-80000000"]]');
insert into public.approvals (id, transaction_id, required, requested_by, checks, created_at) values
  ('30000000-0000-4000-8000-000000002043', '10000000-0000-4000-8000-000000002043', 1, '00000000-0000-4000-8000-000000000187',
   '[["Balance reserved","Ledger hold posted at 12:44","ok"],["Destination screening","Low risk","ok"],["Allowlisted address","Saved 41 days ago","ok"]]', '2026-10-19 12:44+01');

-- DEP-PROTO-2050 · 500 without tag, held in suspense, claimed by CUS-0311
select pg_temp.tx('10000000-0000-4000-8000-000000002050', 'DEP-PROTO-2050', null, 'deposit', 'no_tag',
  500000000, '2026-10-19 11:47+01', '{"counterparty":"rSendrProtoK3PaKcV9tYwZ2hNx","meta":{"claimed_by":"00000000-0000-4000-8000-000000000311","ticket":"SUP-0921"}}',
  '[["detected","2026-10-19 11:47+01","Monitor"],["no_tag","2026-10-19 11:47+01","System","Posted to unattributed deposits (suspense)"]]');
select pg_temp.entry('deposit:no_tag', 'DEP-PROTO-2050', '10000000-0000-4000-8000-000000002050', '2026-10-19 11:47+01',
  '[["", "omnibus", "500000000"], ["", "suspense", "-500000000"]]');
insert into public.approvals (id, transaction_id, required, checks, created_at) values
  ('30000000-0000-4000-8000-000000002050', '10000000-0000-4000-8000-000000002050', 1,
   '[["Validated on ledger","Tx hash recorded from validated ledger","ok"],["Destination tag","Missing — cannot auto-attribute","warn"],["Customer claim","CUS-0311 opened ticket SUP-0921 with tx proof","wait"]]', '2026-10-19 11:47+01');

-- EX-PROTO-0318 · 500 by CUS-0042 needing a firm quote
select pg_temp.tx('10000000-0000-4000-8000-000000000318', 'EX-PROTO-0318', '00000000-0000-4000-8000-000000000420', 'exchange', 'requested',
  500000000, '2026-10-19 12:38+01', '{"meta":{"indicative_cents":"117504"}}', '[["requested","2026-10-19 12:38+01","Customer"]]');
insert into public.approvals (id, transaction_id, required, requested_by, checks, created_at) values
  ('30000000-0000-4000-8000-000000000318', '10000000-0000-4000-8000-000000000318', 1, '00000000-0000-4000-8000-000000000420',
   '[["Customer eligible","Verified, within exchange limits","ok"],["Liquidity provider quote","Not requested yet","wait"]]', '2026-10-19 12:38+01');

-- LN-PROTO-0009 · $1,500 application by CUS-0098
select pg_temp.tx('10000000-0000-4000-8000-000000000009', 'LN-PROTO-0009', '00000000-0000-4000-8000-000000000098', 'loan', 'applied',
  2000000000, '2026-10-19 09:52+01', '{"cents":150000,"meta":{"starting_ltv":"31.5%"}}', '[["applied","2026-10-19 09:52+01","Customer"]]');
insert into public.approvals (id, transaction_id, required, requested_by, checks, created_at) values
  ('30000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009', 1, '00000000-0000-4000-8000-000000000098',
   '[["Identity verified","Verified Sep 2","ok"],["Collateral available","2,000.00 XRP free","ok"],["Agreement accepted","Lending Agreement draft v0.1 at 09:52","ok"],["Provider credit decision","Pending","wait"]]', '2026-10-19 09:52+01');

-- YLD-PROTO-0112 · 300 allocation by CUS-0233, delayed at provider
select pg_temp.tx('10000000-0000-4000-8000-000000000112', 'YLD-PROTO-0112', '00000000-0000-4000-8000-000000000233', 'yield_allocate', 'requested',
  300000000, '2026-10-19 12:11+01', '{"meta":{"product":"XRP Flexible"}}', '[["requested","2026-10-19 12:11+01","Customer"]]');
select pg_temp.entry('yield_allocate:requested', 'YLD-PROTO-0112', '10000000-0000-4000-8000-000000000112', '2026-10-19 12:11+01',
  '[["00000000-0000-4000-8000-000000000233", "available", "300000000"], ["00000000-0000-4000-8000-000000000233", "pending_yield", "-300000000"]]');
insert into public.approvals (id, transaction_id, required, requested_by, checks, created_at) values
  ('30000000-0000-4000-8000-000000000112', '10000000-0000-4000-8000-000000000112', 1, '00000000-0000-4000-8000-000000000233',
   '[["Product terms accepted","Yield Product Terms draft v0.1","ok"],["Above minimum","300 ≥ 50 XRP","ok"]]', '2026-10-19 12:11+01');

-- ───────── Platform: prices, wallets, signers, limits, policy, recon, heartbeat ─────────
insert into public.prices (asset, usd_micro, change_bps, source, at) values
  ('XRP', 2380000, 310, '[Market data provider]', '2026-10-19 12:50+01'),
  ('BTC', 98000000000, 60, '[Market data provider]', '2026-10-19 12:50+01'),
  ('ETH', 3801330000, -85, '[Market data provider]', '2026-10-19 12:50+01'),
  ('SOL', 182400000, 192, '[Market data provider]', '2026-10-19 12:50+01'),
  ('LTC', 94150000, -37, '[Market data provider]', '2026-10-19 12:50+01');
insert into public.custody_wallets (id, name, tier, address, signing, ceiling_drops) values
  ('hot', 'Hot', 'hot', 'rHotProtoKcV9tYwZ2hNa19xQb', 'Auto-sign within policy', 100000000000),
  ('warm', 'Warm', 'warm', 'rWarmProtoKcV9tYwZ2hNb24mKc', '2 of 3 signers', null),
  ('cold', 'Cold vault', 'cold', 'rColdProtoKcV9tYwZ2hNc3V9tY', '3 of 5 · 24h time lock', null)
on conflict (id) do update set name = excluded.name, address = excluded.address, signing = excluded.signing, ceiling_drops = excluded.ceiling_drops;
insert into public.signers (name, meta, status) values
  ('J. Duru · Compliance', 'Hardware key · last used 12:41', 'active'),
  ('K. Musa · Compliance', 'Hardware key · last used Oct 18', 'active'),
  ('A. Bello · Operations', 'Hardware key · last used 10:05', 'active'),
  ('M. Okon · Operations', 'Hardware key · last used Oct 12', 'active'),
  ('Director · Treasury', 'Cold vault only', 'standby');
insert into public.limits (id, label, amount_drops) values
  ('customer_daily', 'Per customer, daily', 25000000000),
  ('auto_sign', 'Per transaction (auto-sign)', 1000000000),
  ('platform_daily', 'Platform outflow, daily', 150000000000);
insert into public.policy_changes (ref, title, requested_by, requested_role, reason, created_at) values
  ('POL-v4', 'Raise hot wallet ceiling to 120,000 XRP', '00000000-0000-4000-9000-00000000a001', 'operations', 'Higher weekend withdrawal volume', '2026-10-19 10:05+01');
insert into public.recon_runs (id, ref, validated_ledger, result, created_at) values
  ('40000000-0000-4000-8000-000000000412', 'RC-PROTO-0412', 92417402,
   '{"hot":{"internal":"84210250036","provider":"84210250000","chain":"84210250000"},"warm":{"internal":"250000000000","provider":"250000000000","chain":"250000000000"},"cold":{"internal":"950400000000","provider":"950400000000","chain":"950400000000"}}',
   '2026-10-19 12:00+01');
insert into public.recon_exceptions (run_id, kind, title, note, transaction_id, status) values
  ('40000000-0000-4000-8000-000000000412', 'unbooked_fee', 'Network fees not booked', 'Hot wallet · 3 withdrawals · 0.000036 XRP', null, 'open'),
  ('40000000-0000-4000-8000-000000000412', 'deposit_no_tag', 'Deposit without destination tag', 'DEP-PROTO-2050 · 500.00 XRP held in suspense', '10000000-0000-4000-8000-000000002050', 'open'),
  ('40000000-0000-4000-8000-000000000412', 'provider_delay', 'Provider confirmation delayed', 'YLD-PROTO-0112 · 300.00 XRP pending at [Yield provider] for 41m', '10000000-0000-4000-8000-000000000112', 'investigating');
insert into public.worker_heartbeat (worker, validated_ledger, nodes_in_sync, at) values ('xrpl-worker', 92418307, 2, now());
insert into public.chain_cursor (id, last_ledger_index) values ('omnibus', 92418307);
insert into public.customer_flags (customer_id, note) values
  ('00000000-0000-4000-8000-000000000311', 'Claims DEP-PROTO-2050 (500 XRP, no tag) · SUP-0921'),
  ('00000000-0000-4000-8000-000000000233', 'Proof of address under review');

set session_replication_role = origin;

-- Audit trail (inserted with triggers on so the hash chain is real).
select public.audit('staff', '00000000-0000-4000-9000-00000000c002', 'K. Musa', 'compliance', 'Signed in to Ops console', 'Session');
select public.audit('customer', 'ACC-PROTO-0042', 'ACC-PROTO-0042', null, 'Signed in · Chrome on macOS', 'Session');
select public.audit('customer', 'CUS-0098', 'CUS-0098', null, 'Submitted loan application', 'LN-PROTO-0009');
select public.audit('staff', '00000000-0000-4000-9000-00000000a001', 'A. Bello', 'operations', 'Requested signing policy change', 'POL-v4');
select public.audit('system', 'monitor', 'System', null, 'Posted deposit to suspense (no tag)', 'DEP-PROTO-2050');
select public.audit('system', 'recon', 'System', null, 'Reconciliation run completed · 3 exceptions', 'RC-PROTO-0412');
select public.audit('staff', '00000000-0000-4000-9000-00000000a002', 'M. Okon', 'operations', 'Linked ticket to deposit', 'SUP-0921');
select public.audit('customer', 'CUS-0233', 'CUS-0233', null, 'Allocated 300 XRP to XRP Flexible', 'YLD-PROTO-0112');
select public.audit('system', 'ledger', 'System', null, 'Reserved 1,250.00 XRP', 'WD-PROTO-2042');
select public.audit('customer', 'CUS-0042', 'CUS-0042', null, 'Submitted exchange request', 'EX-PROTO-0318');
select public.audit('staff', '00000000-0000-4000-9000-00000000c001', 'J. Duru', 'compliance', 'Approved withdrawal · 1 of 2', 'WD-PROTO-2042');
select public.audit('customer', 'CUS-0187', 'CUS-0187', null, 'Submitted withdrawal (2FA verified)', 'WD-PROTO-2043');
select public.audit('system', 'audit', 'System', null, 'Audit chain verified', '—');
select public.run_audit_verification();
refresh materialized view public.balances_snapshot;

-- ───────── Invariant checks: fail the seed if anything is off ─────────
do $$
declare
  unbalanced int;
  avail bigint;
begin
  select count(*) into unbalanced from (select entry_id from public.journal_lines group by entry_id having sum(amount_drops) <> 0) x;
  if unbalanced > 0 then raise exception 'Seed has % unbalanced entries', unbalanced; end if;
  -- Brendan (ACC-PROTO-0042): 4,170.10 available, 1,500.00 yield, 750.00 collateral, nothing reserved.
  select balance_drops into avail from public.balances where customer_id = '00000000-0000-4000-8000-000000000042' and kind = 'available';
  if avail <> 4170100000 then raise exception 'CUS-0042 available is % drops, expected 4170100000', avail; end if;
  if (select balance_drops from public.balances where customer_id = '00000000-0000-4000-8000-000000000042' and kind = 'yield') <> 1500000000 then
    raise exception 'CUS-0042 yield balance mismatch';
  end if;
  if (select balance_drops from public.balances where customer_id = '00000000-0000-4000-8000-000000000042' and kind = 'collateral') <> 750000000 then
    raise exception 'CUS-0042 collateral balance mismatch';
  end if;
  if public.verify_audit_chain() is not null then raise exception 'Audit chain broken after seed'; end if;
end $$;
