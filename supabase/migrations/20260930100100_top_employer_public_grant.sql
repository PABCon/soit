-- 20260930100000_billing_foundation.sql deliberately kept every new
-- billing column off the public/authenticated grants (same treatment as
-- `nif`/verification_*, readable only via my_company()) — but
-- `top_employer_active` isn't a financial detail, it's the public badge/
-- sort fact ("is this company a Top Employer"), so it needs the same
-- public column grant every other company-profile field already has
-- (same gotcha this project has hit before: GRANT is column-additive, a
-- new column is silently unreadable under RLS without its own grant).
grant select (top_employer_active) on companies to anon, authenticated;
