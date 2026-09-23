-- Same gap as 20260922100000_service_role_grants.sql, now hit by the two
-- new browse-page tables: service_role isn't auto-granted on new public
-- tables in this project (unlike Supabase-managed schemas), so every
-- admin-client read/write against `locations`/`job_categories` was
-- failing 42501 despite RLS/anon grants being correct.

grant all on locations, job_categories to service_role;
