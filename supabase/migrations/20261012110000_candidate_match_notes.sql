-- Round 26 (Matchmaking UI, pages 03/04): a blinded match (candidate-
-- matches.ts, §AI Pieces item 3 phase A) has no application record, so
-- `applications.status` can't be reused for it — that enum is scoped to
-- real applicants who've actually applied. This is a deliberately
-- separate, narrower status concept keyed on the (company, job,
-- candidate) triple a match actually is, plus a cache slot for the new
-- blinded "why matched"/AI-summary feature (generated once per pair via
-- an explicit employer click, same not-automatic reasoning as
-- `applications.ai_synopsis` — see that migration's own comment).
--
-- One row per match an employer has actually touched (set a status for,
-- or generated a summary for) — a fresh, untouched match has no row at
-- all and reads as the default 'new' status in application code, exactly
-- like `employer_invites`/`job_ad_purchases` don't pre-create rows for
-- every possible future entity either.
create table candidate_match_notes (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references companies(id) on delete cascade,
  job_id                   uuid not null references jobs(id) on delete cascade,
  candidate_id             uuid not null references candidates(id) on delete cascade,
  status                   text not null default 'new'
                             check (status in ('new', 'shortlisted', 'contacted', 'passed')),
  ai_summary               jsonb,
  ai_summary_generated_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (company_id, job_id, candidate_id)
);
create index candidate_match_notes_company_job_idx on candidate_match_notes (company_id, job_id);

alter table candidate_match_notes enable row level security;

-- Same "any team member, not just the owner" access matching/messaging
-- already grants (candidate-matches.ts's read gate, messaging.ts's
-- getOrCreateThreadForMatch) — this is routine working data for the
-- whole team, not an ownership-sensitive action like inviting a teammate.
grant select, insert, update on candidate_match_notes to authenticated;
grant all on candidate_match_notes to service_role;

create policy "employers manage their own match notes"
  on candidate_match_notes for all to authenticated
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
