-- Candidate CV-upload profile autofill, phase 1 (§ AI Pieces backlog,
-- item 1+2 collapsed — see plan). candidate_tech_tags/candidate_languages
-- deliberately reuse the exact tech_tags/spoken_languages vocabulary and
-- skill_level enum the job side already uses (job_tech_tags/job_languages)
-- so a future matching engine can compare candidate skills against job
-- requirements in the same vocabulary. headline/years_experience are a
-- cheap, single-value substitute for a full work-experience timeline (not
-- built here — see plan). cv_prompt_dismissed backs the first-login prompt.

alter table candidates
  add column headline text,
  add column years_experience integer
    check (years_experience is null or years_experience >= 0),
  add column cv_prompt_dismissed boolean not null default false;

-- candidates already has a blanket `grant select on candidates to
-- authenticated` (no column list) from the original RLS migration, so new
-- columns are already selectable; only UPDATE needs the incremental grant,
-- same convention as every later candidates-column migration.
grant update (headline, years_experience, cv_prompt_dismissed) on candidates to authenticated;

-- ── candidate_tech_tags ──────────────────────────────────────────────────────
create table candidate_tech_tags (
  candidate_id uuid not null references candidates(id) on delete cascade,
  tech_tag_id  uuid not null references tech_tags(id) on delete restrict,
  level        skill_level,
  primary key (candidate_id, tech_tag_id)
);
create index candidate_tech_tags_tech_tag_idx on candidate_tech_tags (tech_tag_id);

alter table candidate_tech_tags enable row level security;

-- Same boundary as candidates itself: owner-only, no employer-read policy.
-- Employer-facing display of applicant skills goes through the admin
-- client (getApplicantsForJob already does this for candidates.skills),
-- not RLS on this table.
grant select, insert, update, delete on candidate_tech_tags to authenticated;
grant all on candidate_tech_tags to service_role;

create policy "candidates manage their own tech tags"
  on candidate_tech_tags for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());

-- ── candidate_languages ──────────────────────────────────────────────────────
create table candidate_languages (
  candidate_id       uuid not null references candidates(id) on delete cascade,
  spoken_language_id uuid not null references spoken_languages(id) on delete restrict,
  level              skill_level,
  primary key (candidate_id, spoken_language_id)
);
create index candidate_languages_language_idx on candidate_languages (spoken_language_id);

alter table candidate_languages enable row level security;

grant select, insert, update, delete on candidate_languages to authenticated;
grant all on candidate_languages to service_role;

create policy "candidates manage their own languages"
  on candidate_languages for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());

-- ── candidate_education ──────────────────────────────────────────────────────
create table candidate_education (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references candidates(id) on delete cascade,
  institution    text not null,
  degree         text,
  field_of_study text,
  start_date     date,
  end_date       date, -- null = ongoing
  note           text,
  created_at     timestamptz not null default now()
);
create index candidate_education_candidate_idx on candidate_education (candidate_id);

alter table candidate_education enable row level security;

grant select, insert, update, delete on candidate_education to authenticated;
grant all on candidate_education to service_role;

create policy "candidates manage their own education"
  on candidate_education for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());
