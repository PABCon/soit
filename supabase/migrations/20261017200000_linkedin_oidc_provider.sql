-- `auth_provider`'s enum still held the old value 'linkedin', not Supabase's
-- real provider id for that integration, 'linkedin_oidc' (the "Sign In with
-- LinkedIn using OpenID Connect" product — the only LinkedIn login product
-- Supabase Auth actually supports). ensureCandidateProfile() reads
-- user.app_metadata.provider directly as of this round, which returns
-- 'linkedin_oidc' verbatim — the enum needs to accept exactly that string,
-- not the old placeholder value nothing ever actually wrote.
-- 'facebook' is already a valid enum value from the original schema
-- (20260921120000_schema.sql) — no change needed for it here.
alter type auth_provider rename value 'linkedin' to 'linkedin_oidc';
