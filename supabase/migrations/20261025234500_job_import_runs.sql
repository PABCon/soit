-- §job-import: bulk-import jobs from an employer's own careers page as
-- drafts. One run per "import this page" click — discovery (finding the
-- individual job links) happens exactly once per run and is stored here,
-- so a stalled/resumed run never re-pays that cost; batches then work
-- through the stored list until either the company's job_ad_slot_cap or
-- the list itself runs out.
create table job_import_runs (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  source_url          text not null,
  status              text not null default 'running' check (status in ('running', 'completed', 'failed')),
  -- [{url, title}], in page order — the discovery LLM's one-time output,
  -- never re-fetched or re-ranked once a run starts.
  discovered_links    jsonb not null default '[]'::jsonb,
  next_index          integer not null default 0,
  imported_count      integer not null default 0,
  skipped_count       integer not null default 0,
  failed_count        integer not null default 0,
  -- Bumped by the safety-net cron each time it has to resume a stalled
  -- run; 3 in a row with no real progress gives up for good rather than
  -- retrying forever (see resume-job-imports/route.ts).
  stalled_resumes     integer not null default 0,
  last_progress_at    timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index job_import_runs_company_idx on job_import_runs (company_id);

-- One running import per company at a time — enforced here, not just in
-- application code, so a double-click or a race can't start two.
create unique index job_import_runs_one_active_per_company
  on job_import_runs (company_id) where (status = 'running');

alter table job_import_runs enable row level security;
grant all on job_import_runs to service_role;

-- A company's own employer_users can see their own import's progress —
-- the page polls this directly rather than needing a separate API route
-- just to report status.
create policy "employers see their own company's import runs"
  on job_import_runs for select to authenticated
  using (company_id = public.my_company_id());

-- Dedup ledger: every URL ever successfully imported for a company,
-- independent of the resulting job's own lifecycle — a re-scan of the
-- same page skips these even if the original draft was later deleted or
-- published, and a run only ever counts a URL here once it has actually
-- created a job (a failed extraction is never recorded, so it's still
-- eligible on the next scan).
create table job_import_sources (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  source_url   text not null,
  job_id       uuid not null references jobs(id) on delete cascade,
  imported_at  timestamptz not null default now(),
  unique (company_id, source_url)
);

alter table job_import_sources enable row level security;
grant all on job_import_sources to service_role;
