-- Same meaning, stated positively. The version stays, so customers aren't asked to accept it again.
update public.legal_documents
set sections = replace(
  sections::text,
  '["No guarantees", "No deposit insurance or guaranteed returns unless stated in a specific product."]',
  '["Product terms", "Deposit insurance and guaranteed returns are applied where a specific product states them."]'
)::jsonb
where id = 'risk';
