-- Real-usage finding: a source posting (itdsportugal.com) quotes two
-- genuinely different amounts for the same role — a gross B2B rate and a
-- net permanent-contract salary — but this schema only ever had one salary
-- range per ad (job_employment_types, added earlier, only tags which
-- contract types a job accepts, with no salary of its own). The AI
-- extraction was conflating the two: picking up the B2B number and
-- attributing it to "Permanent." This migration is the data-model half of
-- the fix — an optional, per-accepted-type salary override, additive on
-- top of the existing ad-level `jobs.salary_*` columns (which remain the
-- "primary" contract type's range, used everywhere outside the job detail
-- page exactly as before: feed, filters, sort, recommendations, JSON-LD).
--
-- `salary_basis` (gross vs net) is a new, explicit field rather than an
-- inferred one — per direct instruction, this is always the employer's own
-- choice in the form, never something the AI/scraper decides on its
-- behalf; extraction only ever *suggests* a value for the employer to
-- confirm, same "never invent, always reviewed" discipline as every other
-- AI-assisted field in this codebase.
alter table jobs
  add column salary_basis text not null default 'gross' check (salary_basis in ('gross', 'net'));

alter table job_employment_types
  add column salary_min integer check (salary_min is null or salary_min > 0),
  add column salary_max integer check (salary_max is null or salary_max > 0),
  add column salary_period salary_period,
  add column salary_months integer check (salary_months is null or salary_months between 12 and 14),
  add column salary_basis text check (salary_basis is null or salary_basis in ('gross', 'net')),
  add constraint job_employment_types_salary_range_ordered
    check (salary_min is null or salary_max is null or salary_max >= salary_min),
  add constraint job_employment_types_months_only_for_monthly
    check (salary_period = 'month' or salary_months is null);
