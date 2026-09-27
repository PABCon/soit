-- SóIT — saved searches (real-usage QA round 3, phase 5): a candidate can
-- save a keyword/location search and come back to it later. Same shape as
-- favorites: scoped to the caller's own candidate_id via the existing
-- my_candidate_id() helper, insert/delete/select happen directly from the
-- browser client under RLS, no admin client needed.
--
-- No email/notification delivery is wired up yet — deliberately out of
-- scope for this pass (no real email sender or scheduled-job infra exists
-- in this project yet; see CLAUDE.md). This table only supports save/list/
-- delete for now.

create table saved_searches (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  -- Denormalized, human-readable label computed at save time (e.g. "React
  -- em Lisboa") — cheap to store, avoids re-deriving it from `query` on
  -- every render of the management page, and stays stable if the featured
  -- tech/category label text ever changes.
  label        text not null,
  query        jsonb not null,
  created_at   timestamptz not null default now(),

  unique (candidate_id, query)
);

create index saved_searches_candidate_idx on saved_searches (candidate_id);

alter table saved_searches enable row level security;

revoke all on saved_searches from anon, authenticated;
grant select, insert, delete on saved_searches to authenticated;
-- service_role does NOT auto-inherit table privileges in this project (see
-- supabase/migrations/README.md) — granted explicitly up front.
grant all on saved_searches to service_role;

create policy "candidates manage their own saved searches"
  on saved_searches for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());
