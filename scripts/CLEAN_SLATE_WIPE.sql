-- ============================================================================
-- Just IT — full clean-slate data wipe (pre-launch)
-- Written 2026-10-19. FOR MANUAL REVIEW + MANUAL EXECUTION ONLY.
-- Never run this via `supabase db push`/migrations — it is NOT a migration,
-- it is a one-off destructive admin script. Run it by hand, once, pasted
-- directly into Supabase's SQL Editor, after reading it fully.
-- ============================================================================
--
-- WHAT THIS DOES
-- Deletes every row of user/business-generated data — every company
-- (including ITDS and Test Company, explicitly, per direct confirmation —
-- not an oversight), every employer/candidate account and all of their
-- jobs, applications, messages, favorites, saved searches, billing
-- history, API keys, profile content, etc. — and then deletes every
-- `auth.users` row, so zero real accounts remain either.
--
-- WHAT THIS DELIBERATELY DOES NOT TOUCH
--   - The curated reference tables: locations, job_categories, tech_tags,
--     spoken_languages. These are seed/reference data, not user-generated,
--     and the product is unusable without them. Verified via their own
--     "before"/"after" counts below — they must read identical.
--   - Any schema/migration-history tables, RLS policies, functions, or
--     grants. This script only deletes rows; it alters no structure.
--   - The `auth` schema beyond the single `delete from auth.users;`
--     statement — Supabase's own built-in auth.identities/auth.sessions/
--     auth.refresh_tokens/auth.mfa_*/auth.one_time_tokens tables all carry
--     their own `on delete cascade` FK to auth.users (Supabase's standard
--     schema, not something this project defined) — they clean up
--     automatically from that one statement; nothing else in `auth` is
--     touched directly.
--   - The `storage` schema (storage.objects/storage.buckets) — NOT
--     touched at all, per explicit instruction. This means the actual
--     uploaded files (CVs in the `cvs` bucket, avatars, company branding
--     images, message attachments) become orphaned after this script
--     runs — their owning rows will be gone, but the files themselves
--     will still sit in storage. If a true clean slate should also clear
--     those buckets, that is a separate, explicit follow-up — flagging
--     it here, not doing it, since it wasn't asked for in this script.
--   - The `events` table (`public.events`) — it has no foreign key to
--     companies/candidates/jobs/employer_users (just a bare `actor_id
--     uuid` with no FK constraint at all), so nothing here requires
--     touching it, and it wasn't named in the list of tables to wipe. If
--     the intent was also to clear analytics/event history, that's a
--     separate decision — flagging, not assuming.
--
-- TABLE LIST — VERIFIED AGAINST THE REAL MIGRATIONS, NOT GUESSED
-- Every table below was found via `grep -n "references companies(\|
-- references candidates(\|references jobs(\|references employer_users(\|
-- references message_threads(" supabase/migrations/*.sql` — i.e. this is
-- the actual, complete set of tables carrying a foreign key into
-- companies/candidates/jobs/employer_users (directly or transitively via
-- message_threads), plus the four root tables themselves. One table not
-- in the coordinator's own draft list was found this way and added:
-- `employer_invites` (references both companies and employer_users).
-- `skill_suggestions` has no FK to anything (it's a standalone aggregate
-- table) but is included anyway since it was explicitly named as
-- business-generated data to clear.
--
-- DELETION ORDER — this respects every real `on delete restrict`
-- constraint in the schema (the only three that actually block, found by
-- reading the same migrations): applications.job_id → jobs (restrict),
-- jobs.company_id → companies (restrict), employer_users.company_id →
-- companies (restrict). Every other FK here is `cascade` or `set null`,
-- which would clean up automatically even in the wrong order — but every
-- table is still deleted explicitly, in dependency order, rather than
-- relying on cascades, so the per-table "after" counts below are real
-- and meaningful, not just zero-because-cascade.
--
-- ============================================================================
-- STOP — DO THIS FIRST, BEFORE RUNNING ANYTHING BELOW
-- ============================================================================
-- Cancel both real Stripe subscriptions manually, in the Stripe
-- Dashboard, BEFORE running this script — otherwise their companies get
-- deleted here while Stripe keeps billing with no company left behind
-- them on this side.
--
--   1. Test Company — subscription id on record from earlier rounds:
--        sub_1ULV1zEfmibRYZh3eJGptjkS
--      Stripe Dashboard → Customers → find "Test Company" → Subscriptions
--      → Cancel.
--
--   2. ITDS — its current subscription id is NOT on record in this
--      round (this round was explicitly read-only against the live
--      database/Stripe — nothing was looked up live). Find it the same
--      way: Stripe Dashboard → Customers → search "ITDS" → Subscriptions
--      → Cancel. (If you want it confirmed from this side first, that's
--      a separate read-only lookup — ask for it before running this
--      script, not after.)
--
-- Only run the DELETE block below once BOTH cancellations are confirmed
-- done. Running this script does not cancel anything in Stripe itself —
-- `company_subscriptions`/`job_ad_purchases` rows are just this app's own
-- local record of billing history; deleting them has zero effect on the
-- real, live Stripe subscription.
-- ============================================================================


-- ============================================================================
-- STEP 0a — BEFORE snapshot. Run this first and read the output before
-- running anything else. Shows one row per table with its real current
-- count, in the same order they'll be deleted, plus the four reference
-- tables at the end (expected to read identical before and after).
-- ============================================================================
with counts as (
  select  1 as ord, 'messages'                         as table_name, (select count(*) from messages)                         as row_count
  union all select  2, 'job_tech_tags',                 (select count(*) from job_tech_tags)
  union all select  3, 'job_languages',                 (select count(*) from job_languages)
  union all select  4, 'job_employment_types',          (select count(*) from job_employment_types)
  union all select  5, 'favorites',                     (select count(*) from favorites)
  union all select  6, 'candidate_tech_tags',           (select count(*) from candidate_tech_tags)
  union all select  7, 'candidate_languages',           (select count(*) from candidate_languages)
  union all select  8, 'candidate_education',           (select count(*) from candidate_education)
  union all select  9, 'candidate_experience',          (select count(*) from candidate_experience)
  union all select 10, 'candidate_certifications',      (select count(*) from candidate_certifications)
  union all select 11, 'candidate_preferred_categories',(select count(*) from candidate_preferred_categories)
  union all select 12, 'candidate_preferred_locations', (select count(*) from candidate_preferred_locations)
  union all select 13, 'company_team_members',          (select count(*) from company_team_members)
  union all select 14, 'company_testimonials',          (select count(*) from company_testimonials)
  union all select 15, 'company_gallery_photos',        (select count(*) from company_gallery_photos)
  union all select 16, 'company_gallery_videos',        (select count(*) from company_gallery_videos)
  union all select 17, 'company_api_keys',              (select count(*) from company_api_keys)
  union all select 18, 'job_ad_purchases',               (select count(*) from job_ad_purchases)
  union all select 19, 'company_subscriptions',          (select count(*) from company_subscriptions)
  union all select 20, 'tech_tag_requests',              (select count(*) from tech_tag_requests)
  union all select 21, 'candidate_match_notes',          (select count(*) from candidate_match_notes)
  union all select 22, 'skill_suggestions',              (select count(*) from skill_suggestions)
  union all select 23, 'saved_searches',                 (select count(*) from saved_searches)
  union all select 24, 'applications',                   (select count(*) from applications)
  union all select 25, 'message_threads',                (select count(*) from message_threads)
  union all select 26, 'employer_invites',               (select count(*) from employer_invites)
  union all select 27, 'jobs',                           (select count(*) from jobs)
  union all select 28, 'employer_users',                 (select count(*) from employer_users)
  union all select 29, 'candidates',                     (select count(*) from candidates)
  union all select 30, 'companies',                      (select count(*) from companies)
  union all select 31, 'auth.users',                     (select count(*) from auth.users)
  union all select 40, '--- reference tables below, must stay unchanged ---', null
  union all select 41, 'locations',                      (select count(*) from locations)
  union all select 42, 'job_categories',                 (select count(*) from job_categories)
  union all select 43, 'tech_tags',                      (select count(*) from tech_tags)
  union all select 44, 'spoken_languages',               (select count(*) from spoken_languages)
)
select table_name, row_count from counts order by ord;


-- ============================================================================
-- STEP 0b — sanity check: which companies are about to be deleted.
-- Read this and confirm it's exactly the set you expect (should include
-- ITDS and Test Company, plus anything else real that currently exists)
-- before proceeding to the delete block.
-- ============================================================================
select id, company_name, nif, created_at from companies order by created_at;


-- ============================================================================
-- STEP 1 — THE ACTUAL WIPE. Everything below runs as one transaction:
-- either it all applies, or (on any error) none of it does.
-- ============================================================================
begin;

delete from messages;
delete from job_tech_tags;
delete from job_languages;
delete from job_employment_types;
delete from favorites;
delete from candidate_tech_tags;
delete from candidate_languages;
delete from candidate_education;
delete from candidate_experience;
delete from candidate_certifications;
delete from candidate_preferred_categories;
delete from candidate_preferred_locations;
delete from company_team_members;
delete from company_testimonials;
delete from company_gallery_photos;
delete from company_gallery_videos;
delete from company_api_keys;
delete from job_ad_purchases;
delete from company_subscriptions;
delete from tech_tag_requests;
delete from candidate_match_notes;
delete from skill_suggestions;
delete from saved_searches;
delete from applications;
delete from message_threads;
delete from employer_invites;
delete from jobs;
delete from employer_users;
delete from candidates;
delete from companies;

-- Zero real accounts remain. Supabase's own auth-schema tables
-- (auth.identities, auth.sessions, auth.refresh_tokens, auth.mfa_factors,
-- auth.mfa_challenges, auth.mfa_amr_claims, auth.one_time_tokens,
-- auth.flow_state, etc.) all cascade off auth.users via Supabase's own
-- built-in schema — not something this project defined, and not touched
-- directly here.
delete from auth.users;

commit;


-- ============================================================================
-- STEP 2 — AFTER snapshot. Run this once the COMMIT above has completed.
-- Every row in the first group should now read 0. The reference-table
-- group below the separator should read exactly the same numbers as the
-- BEFORE snapshot in step 0a — if any of those four changed, something
-- touched data it shouldn't have and needs investigating before trusting
-- the rest of this run.
-- ============================================================================
with counts as (
  select  1 as ord, 'messages'                         as table_name, (select count(*) from messages)                         as row_count
  union all select  2, 'job_tech_tags',                 (select count(*) from job_tech_tags)
  union all select  3, 'job_languages',                 (select count(*) from job_languages)
  union all select  4, 'job_employment_types',          (select count(*) from job_employment_types)
  union all select  5, 'favorites',                     (select count(*) from favorites)
  union all select  6, 'candidate_tech_tags',           (select count(*) from candidate_tech_tags)
  union all select  7, 'candidate_languages',           (select count(*) from candidate_languages)
  union all select  8, 'candidate_education',           (select count(*) from candidate_education)
  union all select  9, 'candidate_experience',          (select count(*) from candidate_experience)
  union all select 10, 'candidate_certifications',      (select count(*) from candidate_certifications)
  union all select 11, 'candidate_preferred_categories',(select count(*) from candidate_preferred_categories)
  union all select 12, 'candidate_preferred_locations', (select count(*) from candidate_preferred_locations)
  union all select 13, 'company_team_members',          (select count(*) from company_team_members)
  union all select 14, 'company_testimonials',          (select count(*) from company_testimonials)
  union all select 15, 'company_gallery_photos',        (select count(*) from company_gallery_photos)
  union all select 16, 'company_gallery_videos',        (select count(*) from company_gallery_videos)
  union all select 17, 'company_api_keys',              (select count(*) from company_api_keys)
  union all select 18, 'job_ad_purchases',               (select count(*) from job_ad_purchases)
  union all select 19, 'company_subscriptions',          (select count(*) from company_subscriptions)
  union all select 20, 'tech_tag_requests',              (select count(*) from tech_tag_requests)
  union all select 21, 'candidate_match_notes',          (select count(*) from candidate_match_notes)
  union all select 22, 'skill_suggestions',              (select count(*) from skill_suggestions)
  union all select 23, 'saved_searches',                 (select count(*) from saved_searches)
  union all select 24, 'applications',                   (select count(*) from applications)
  union all select 25, 'message_threads',                (select count(*) from message_threads)
  union all select 26, 'employer_invites',               (select count(*) from employer_invites)
  union all select 27, 'jobs',                           (select count(*) from jobs)
  union all select 28, 'employer_users',                 (select count(*) from employer_users)
  union all select 29, 'candidates',                     (select count(*) from candidates)
  union all select 30, 'companies',                      (select count(*) from companies)
  union all select 31, 'auth.users',                     (select count(*) from auth.users)
  union all select 40, '--- reference tables below, must stay unchanged ---', null
  union all select 41, 'locations',                      (select count(*) from locations)
  union all select 42, 'job_categories',                 (select count(*) from job_categories)
  union all select 43, 'tech_tags',                      (select count(*) from tech_tags)
  union all select 44, 'spoken_languages',               (select count(*) from spoken_languages)
)
select table_name, row_count from counts order by ord;
