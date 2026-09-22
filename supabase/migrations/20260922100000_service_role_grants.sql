-- SóIT — explicit service_role grants (fixes a step-2 gap)
--
-- Discovered while building step 3: service_role had only TRUNCATE,
-- REFERENCES and TRIGGER on every table this project's migrations created —
-- never SELECT/INSERT/UPDATE/DELETE. This project's `public` schema default
-- privileges auto-grant anon/authenticated on new tables (which is why §6.1
-- revokes them explicitly) but do NOT auto-grant service_role — unlike
-- Supabase-managed schemas (storage, auth), where service_role already has
-- full access by platform default.
--
-- Without this, every server-side privileged write (§6.1: registration,
-- applications, verification, event logging — anything using the admin
-- client) silently failed with 42501 regardless of RLS. service_role still
-- bypasses RLS itself (rls_bypass role attribute); this is the separate,
-- ordinary GRANT layer underneath it.

grant all on
  companies, employer_users, employer_invites, candidates, jobs,
  tech_tags, job_tech_tags, applications, events
to service_role;

grant select on live_jobs to service_role;
