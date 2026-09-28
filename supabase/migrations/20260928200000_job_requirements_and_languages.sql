-- Real-usage QA (employer-console review, item 10b/11): must-have tech
-- with a proficiency level, plus a separate "working languages required"
-- concept — distinct from jobs.language (the ad's own PT/EN text
-- language). Both a job-side vocabulary for the future candidate-scoring
-- engine, not the scoring itself.

create type skill_level as enum ('basic', 'intermediate', 'advanced', 'expert');

-- job_tech_tags already links a job to a tech tag; extending it in place
-- (level + required) matches the reference screenshot's own "TECH STACK:
-- SQL — Advanced" display and needs no new table. Existing rows default to
-- required=true (every tag chosen today was implicitly required) and
-- level=null (no level concept existed before this).
alter table job_tech_tags
  add column level skill_level,
  add column required boolean not null default true;

-- ── spoken_languages ─────────────────────────────────────────────────────────
-- A small curated reference table, same shape as locations/job_categories.
create table spoken_languages (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  created_at timestamptz not null default now()
);

insert into spoken_languages (slug, label) values
  ('english', 'English'),
  ('portuguese', 'Portuguese'),
  ('spanish', 'Spanish'),
  ('french', 'French'),
  ('german', 'German');

alter table spoken_languages enable row level security;
grant select on spoken_languages to anon, authenticated;
create policy "spoken languages are publicly readable"
  on spoken_languages for select to anon, authenticated using (true);
grant all on spoken_languages to service_role;

-- ── job_languages ────────────────────────────────────────────────────────────
-- Same shape as job_tech_tags: a job's required working languages, each
-- with its own proficiency level.
create table job_languages (
  job_id             uuid not null references jobs(id) on delete cascade,
  spoken_language_id uuid not null references spoken_languages(id) on delete restrict,
  level              skill_level,
  primary key (job_id, spoken_language_id)
);
create index job_languages_language_idx on job_languages (spoken_language_id);

alter table job_languages enable row level security;

grant select on job_languages to anon, authenticated;
grant insert, delete on job_languages to authenticated;
grant all on job_languages to service_role;

create policy "job languages are public"
  on job_languages for select to anon, authenticated using (true);

create policy "employers set their company's job languages"
  on job_languages for insert to authenticated
  with check (exists (
    select 1 from jobs j
    where j.id = job_languages.job_id and j.company_id = public.my_company_id()
  ));

create policy "employers unset their company's job languages"
  on job_languages for delete to authenticated
  using (exists (
    select 1 from jobs j
    where j.id = job_languages.job_id and j.company_id = public.my_company_id()
  ));
