-- Real-usage QA item: "multiple contract types on one job ad (B2B +
-- permanent)" — jobs.employment_type is a single enum column, so an
-- employer offering a role as either permanent or B2B/contractor had
-- to either pick one (misleading) or post it twice (duplicate
-- listings, duplicate applicant pools). Same join-table shape as
-- job_tech_tags/job_languages: jobs.employment_type itself is kept —
-- not removed — as the "primary" type (the first one the employer
-- picked), since plenty of existing code only ever needs one value
-- (the public API's existing `employmentType` field, JSON-LD's
-- single-value fallback, sort/default display); this table is the
-- full set a job actually accepts, additive on top of that.
create table job_employment_types (
  job_id          uuid not null references jobs(id) on delete cascade,
  employment_type text not null check (employment_type in ('permanent', 'fixed_term', 'contractor', 'freelance', 'internship')),
  primary key (job_id, employment_type)
);
create index job_employment_types_job_idx on job_employment_types (job_id);

alter table job_employment_types enable row level security;

grant select on job_employment_types to anon, authenticated;
grant insert, delete on job_employment_types to authenticated;
grant all on job_employment_types to service_role;

create policy "job employment types are public"
  on job_employment_types for select to anon, authenticated using (true);

create policy "employers tag their company's jobs with employment types"
  on job_employment_types for insert to authenticated
  with check (exists (
    select 1 from jobs j
    where j.id = job_employment_types.job_id and j.company_id = public.my_company_id()
  ));

create policy "employers untag their company's jobs' employment types"
  on job_employment_types for delete to authenticated
  using (exists (
    select 1 from jobs j
    where j.id = job_employment_types.job_id and j.company_id = public.my_company_id()
  ));

-- Backfill: every existing job already implicitly "accepts" its own
-- single employment_type — give it a row here too, so getLiveJobs()'s
-- new job_employment_types join never comes back empty for jobs that
-- predate this feature.
insert into job_employment_types (job_id, employment_type)
select id, employment_type from jobs
on conflict do nothing;
