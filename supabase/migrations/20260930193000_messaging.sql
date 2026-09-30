-- Direct messaging between employers and candidates (§AI Pieces backlog):
-- two entry points, one thread shape — matching outreach (identity
-- blinded until the candidate's first reply) and direct contact with a
-- candidate who already applied (identity known from the start, since
-- applying is itself the identification). `candidates` keeps its
-- existing zero-employer-read-access policy untouched — these tables
-- carry no candidate PII at all, so the blinding rule lives entirely in
-- application code (candidate-matches.ts's/applications.ts's already-
-- established admin-client pattern), never in a new RLS policy.

create table message_threads (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references companies(id) on delete cascade,
  candidate_id           uuid not null references candidates(id) on delete cascade,
  job_id                 uuid not null references jobs(id) on delete cascade,
  origin                 text not null check (origin in ('application', 'match')),
  identity_unlocked      boolean not null default false,
  employer_last_read_at  timestamptz,
  candidate_last_read_at timestamptz,
  created_at             timestamptz not null default now(),
  last_message_at        timestamptz not null default now(),
  unique (company_id, candidate_id, job_id)
);
create index message_threads_company_idx on message_threads (company_id);
create index message_threads_candidate_idx on message_threads (candidate_id);

create table messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references message_threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('employer', 'candidate')),
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);
create index messages_thread_idx on messages (thread_id, created_at);

alter table message_threads enable row level security;
alter table messages        enable row level security;

grant all on message_threads to service_role;
grant all on messages to service_role;

-- ── message_threads ─────────────────────────────────────────────────────────
-- Only employers create threads (both origins start with an employer
-- message, per the reference mechanic) — candidates reply within one,
-- they never start one. Each side may only update their own read marker.
grant select, insert on message_threads to authenticated;
grant update (employer_last_read_at) on message_threads to authenticated;
grant update (candidate_last_read_at) on message_threads to authenticated;

create policy "employers manage their own threads"
  on message_threads for all to authenticated
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

create policy "candidates see and update their own threads"
  on message_threads for select to authenticated
  using (candidate_id = public.my_candidate_id());

create policy "candidates update their own read marker"
  on message_threads for update to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());

-- ── messages ─────────────────────────────────────────────────────────────────
-- Never trust a client-supplied thread_id without joining back through
-- message_threads — same discipline applications' own policy already
-- established for job_id -> company_id.
grant select, insert on messages to authenticated;

create policy "employers see and send in their own threads"
  on messages for all to authenticated
  using (exists (
    select 1 from message_threads t
    where t.id = messages.thread_id and t.company_id = public.my_company_id()
  ))
  with check (exists (
    select 1 from message_threads t
    where t.id = messages.thread_id and t.company_id = public.my_company_id()
  ));

create policy "candidates see and send in their own threads"
  on messages for all to authenticated
  using (exists (
    select 1 from message_threads t
    where t.id = messages.thread_id and t.candidate_id = public.my_candidate_id()
  ))
  with check (exists (
    select 1 from message_threads t
    where t.id = messages.thread_id and t.candidate_id = public.my_candidate_id()
  ));
