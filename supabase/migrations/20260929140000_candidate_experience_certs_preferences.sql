-- Real-usage feedback on the CV-autofill feature (§AI Pieces backlog):
-- work history and certifications aren't captured at all today, and
-- there's no job-preferences concept to scope a future recommendation
-- engine's matches. Same conventions as the phase-1 migration
-- (20260929120000_candidate_skills_and_education.sql): owner-only RLS
-- via my_candidate_id(), delete-then-reinsert-friendly join tables,
-- incremental `grant update` for new `candidates` columns (blanket
-- `select` already covers them).

create table candidate_experience (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  title        text not null,
  company      text not null,
  location     text,
  start_date   date,
  end_date     date, -- null = present
  description  text,
  created_at   timestamptz not null default now()
);
create index candidate_experience_candidate_idx on candidate_experience (candidate_id);

alter table candidate_experience enable row level security;
grant select, insert, update, delete on candidate_experience to authenticated;
grant all on candidate_experience to service_role;

create policy "candidates manage their own experience"
  on candidate_experience for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());

create table candidate_certifications (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  name         text not null,
  issuer       text,
  issued_date  date,
  created_at   timestamptz not null default now()
);
create index candidate_certifications_candidate_idx on candidate_certifications (candidate_id);

alter table candidate_certifications enable row level security;
grant select, insert, update, delete on candidate_certifications to authenticated;
grant all on candidate_certifications to service_role;

create policy "candidates manage their own certifications"
  on candidate_certifications for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());

create table candidate_preferred_categories (
  candidate_id uuid not null references candidates(id) on delete cascade,
  category_id  uuid not null references job_categories(id) on delete cascade,
  primary key (candidate_id, category_id)
);

alter table candidate_preferred_categories enable row level security;
grant select, insert, delete on candidate_preferred_categories to authenticated;
grant all on candidate_preferred_categories to service_role;

create policy "candidates manage their own preferred categories"
  on candidate_preferred_categories for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());

create table candidate_preferred_locations (
  candidate_id uuid not null references candidates(id) on delete cascade,
  location_id  uuid not null references locations(id) on delete cascade,
  primary key (candidate_id, location_id)
);

alter table candidate_preferred_locations enable row level security;
grant select, insert, delete on candidate_preferred_locations to authenticated;
grant all on candidate_preferred_locations to service_role;

create policy "candidates manage their own preferred locations"
  on candidate_preferred_locations for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());

alter table candidates
  add column preferred_work_model text
    check (preferred_work_model in ('remote', 'hybrid', 'office')),
  add column preferred_employment_type text
    check (preferred_employment_type in
      ('permanent', 'fixed_term', 'contractor', 'freelance', 'internship')),
  add column desired_salary_min integer check (desired_salary_min is null or desired_salary_min >= 0),
  add column desired_salary_max integer check (desired_salary_max is null or desired_salary_max >= 0),
  add column desired_salary_period text
    check (desired_salary_period in ('hour', 'day', 'month', 'year'));

grant update (
  preferred_work_model, preferred_employment_type,
  desired_salary_min, desired_salary_max, desired_salary_period
) on candidates to authenticated;
