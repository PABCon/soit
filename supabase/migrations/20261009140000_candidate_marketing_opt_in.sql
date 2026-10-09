-- Real-usage QA item: candidate settings had no marketing-preferences
-- control at all. Defaults to false — opt-in, not opt-out, since no
-- consent has ever been collected for existing rows.
alter table candidates
  add column marketing_opt_in boolean not null default false;

-- Self-service column, same treatment as the other candidate-editable
-- fields (20260921120100_rls.sql's own `grant update (full_name, phone,
-- cv_url, linkedin_url, avatar_url, skills)`) — an additive grant
-- rather than editing that already-applied migration.
grant update (marketing_opt_in) on candidates to authenticated;
