-- Richer company profile (real-usage QA): company type + social links,
-- alongside the existing logo/cover/description/website/industry/size.

alter table companies
  add column company_type text,
  add column facebook_url text,
  add column linkedin_url text,
  add column instagram_url text,
  add column youtube_url text,
  add column tiktok_url text,
  add column x_url text;

-- GRANT is column-additive, not a replace — the new columns need their own
-- grant or they're silently unreadable/unwritable under RLS despite the ALTER
-- above succeeding (same class of gap as the service_role grants incident).
grant select (company_type, facebook_url, linkedin_url, instagram_url, youtube_url, tiktok_url, x_url)
  on companies to anon, authenticated;
grant update (company_type, facebook_url, linkedin_url, instagram_url, youtube_url, tiktok_url, x_url)
  on companies to authenticated;
