-- Bulk job-import feature: an externally-scraped posting often has no
-- stated salary at all, but this product's own rule #1 (§1) is that every
-- PUBLISHED listing always shows one — never loosened for what's actually
-- live. The fix is narrower than it looks: a draft was never a published
-- listing in the first place, so there's nothing wrong with a draft
-- temporarily having no salary, as long as the database itself still
-- guarantees a published job can never be missing one — enforced below,
-- not just trusted to application code.
alter table jobs alter column salary_min drop not null;
alter table jobs alter column salary_max drop not null;
-- The existing `check (salary_min > 0)` already passes vacuously on NULL
-- (Postgres CHECK constraints only reject FALSE, not NULL) — so dropping
-- NOT NULL is sufficient on its own to allow "no salary yet" while still
-- rejecting a real but invalid value like 0 or a negative number.

alter table jobs add constraint jobs_published_requires_salary
  check (status != 'published' or (salary_min is not null and salary_max is not null));
