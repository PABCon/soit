-- Matchmaking rework, Phase 2 (full context: CLAUDE.md). A real, direct
-- gap confirmed during the scoring-bug investigation: `candidates` has
-- no field anywhere representing where a candidate actually lives —
-- only `candidate_preferred_locations`, a job-search preference the
-- candidate opts into, often left empty. This is a separate, narrower
-- fact ("where is this person based") from that preference, and from
-- `jobs.location_id` ("where is this role based") — reuses the same
-- curated `locations` table both of those already do, rather than free
-- text, so it can be compared by id the same way job matching already
-- compares category/location ids.
alter table candidates
  add column location_id uuid references locations(id);

-- Self-service column, same "select on candidates" is already
-- table-level (20260921120100_rls.sql), only update needs an additive
-- per-column grant — same convention as marketing_opt_in's own migration.
grant update (location_id) on candidates to authenticated;
