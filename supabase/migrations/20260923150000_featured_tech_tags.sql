-- SóIT — two more curated browse facets (real-usage QA): a small "most
-- common" set of programming languages and a small "most common" set of
-- other technologies, surfaced as their own quick-filter rows on /jobs —
-- distinct from the full 159-entry tech_tags vocabulary (still used as-is
-- for JobForm's tag picker and general tech-facet browsing) and distinct
-- from job_categories (job function/domain, unrelated dimension).
--
-- Nullable, not a new table: most tech_tags rows stay unfeatured. Browsed
-- through the same /jobs/in/[location]/[facet] route already built for
-- tech_tags.slug — no new URL scheme needed.

alter table tech_tags
  add column featured_group text
    check (featured_group in ('language', 'technology'));

update tech_tags set featured_group = 'language'
  where slug in ('javascript', 'typescript', 'python', 'java', 'csharp', 'php', 'go', 'ruby', 'cpp', 'sql');

update tech_tags set featured_group = 'technology'
  where slug in ('react', 'nodejs', 'aws', 'azure', 'docker', 'kubernetes', 'postgresql', 'angular', 'spring-boot', 'dotnet');
