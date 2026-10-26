-- GRANT and RLS are separate layers (a recurring gotcha in this project).
-- job_import_runs' own "employers see their own company's import runs"
-- policy (from its original migration) has been silently dead since
-- creation — that migration only ever granted service_role, so
-- `authenticated` had no table-level access at all regardless of the
-- policy. Harmless so far (nothing has queried it through a session-
-- scoped client yet, only the admin client in job-imports.ts) — fixed
-- here while it's already being looked at.
grant select on job_import_runs to authenticated;
