-- SóIT — favorites (real-usage QA round 3, phase 3): a candidate can save a
-- job to review later. Same shape as applications/candidates: scoped to the
-- caller's own candidate_id via the existing my_candidate_id() helper, no
-- admin client needed since a candidate only ever touches their own rows —
-- insert/delete happen directly from the browser client under RLS.

create table favorites (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  job_id       uuid not null references jobs(id) on delete cascade,
  created_at   timestamptz not null default now(),

  unique (candidate_id, job_id)
);

create index favorites_candidate_idx on favorites (candidate_id);

alter table favorites enable row level security;

revoke all on favorites from anon, authenticated;
grant select, insert, delete on favorites to authenticated;
-- service_role does NOT auto-inherit table privileges in this project (see
-- supabase/migrations/README.md, "service_role had no table privileges" —
-- every new table needs this explicitly, so it's granted here up front
-- rather than risking the same gap needing a follow-up patch migration).
grant all on favorites to service_role;

create policy "candidates manage their own favorites"
  on favorites for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());
