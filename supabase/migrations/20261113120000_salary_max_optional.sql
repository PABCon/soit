-- Real-usage/product decision (2026-11-13): a company should be nudged
-- toward actually sharing a real salary minimum rather than reaching for
-- the separate, all-or-nothing `salary_public` hide toggle just because
-- it doesn't want to commit to an exact ceiling yet. Relaxing the
-- published-jobs guarantee from "min and max both required" to "min
-- required, max optional" is what makes that nudge real — it's no
-- longer a harder requirement to publish with a real number than to
-- publish with none at all.
--
-- `jobs_published_requires_salary` was added in
-- 20261025234400_nullable_salary_for_imported_drafts.sql for a narrower
-- reason (letting a scraped draft land with no salary at all, never a
-- published one) — this loosens that same constraint one step further,
-- it does not touch the already-nullable columns themselves.
alter table jobs drop constraint jobs_published_requires_salary;

alter table jobs add constraint jobs_published_requires_salary
  check (status != 'published' or salary_min is not null);
