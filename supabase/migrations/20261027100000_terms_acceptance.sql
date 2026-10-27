-- GDPR/compliance audit finding: the main registration flow (both roles)
-- never asked anyone to accept the Terms of Use / Privacy Policy, and
-- nothing recorded it even where a checkbox already existed (the
-- anonymous-apply consent checkbox, §6.7v1.11). A UI checkbox alone isn't
-- a defensible record once the request completes — these two columns are
-- the actual proof: what exactly was agreed to (CURRENT_TERMS_VERSION at
-- the time, src/lib/legal.ts) and when. Written only by the admin client
-- during profile creation (ensureCandidateProfile/ensureEmployerProfile),
-- same as every other field set at that point — no authenticated-role
-- grant needed, and `candidates`' own existing table-wide `grant select
-- ... to authenticated` already covers reading these two new columns back
-- without any change here.
alter table candidates
  add column terms_accepted_at timestamptz,
  add column terms_version text;

alter table employer_users
  add column terms_accepted_at timestamptz,
  add column terms_version text;
