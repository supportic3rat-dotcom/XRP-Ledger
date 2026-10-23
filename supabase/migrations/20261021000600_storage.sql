-- Private buckets: KYC files are uploaded through signed URLs from the kyc-session function and are
-- readable only by Compliance. Statements are readable by their owner.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('kyc', 'kyc', false), ('statements', 'statements', false)
    on conflict (id) do nothing;
    execute $p$create policy kyc_compliance_read on storage.objects for select to authenticated
      using (bucket_id = 'kyc' and public.app_role() = 'compliance')$p$;
    execute $p$create policy statements_owner_read on storage.objects for select to authenticated
      using (bucket_id = 'statements' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;
