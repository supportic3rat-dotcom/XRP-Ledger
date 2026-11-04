-- Once identity is verified, the customer can read the straight-on face photo from that check: it becomes their
-- profile picture. Every other identity file stays readable by Compliance only.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute $p$create policy kyc_own_verified_selfie on storage.objects for select to authenticated
      using (
        bucket_id = 'kyc'
        and storage.filename(name) = 'selfie'
        and (storage.foldername(name))[1] = auth.uid()::text
        and public.mfa_satisfied()
        and exists (select 1 from public.kyc_checks k where k.customer_id = auth.uid() and k.status = 'verified' and name = any(k.documents))
      )$p$;
  end if;
end $$;
