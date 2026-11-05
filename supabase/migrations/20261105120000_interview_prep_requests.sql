-- Interview prep booking (growth plan, Track C): a candidate requests a
-- slot; the actual scheduling/confirmation happens by a human replying to
-- the notification email this triggers, not by any real-time calendar
-- sync — deliberately simple, matching the real capacity this is scoped
-- around (one person coordinating sessions by hand, not a self-serve
-- booking platform). Same ownership shape as saved_searches: scoped to
-- the caller's own candidate_id via my_candidate_id(), insert/select
-- directly from the browser client under RLS.
--
-- The 2-day-minimum lead time (no same-day or next-day requests) is
-- enforced in application code at request time, not as a DB constraint —
-- "today" is relative to when the row is inserted, which a CHECK
-- constraint comparing requested_date against now() would get right at
-- insert time but couldn't re-validate later if ever needed, and the
-- real validation already has to happen server-side in the action either
-- way (never trust the client-side date-picker min alone).

create table interview_prep_requests (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references candidates(id) on delete cascade,
  requested_date  date not null,
  requested_time  time not null,
  note            text,
  created_at      timestamptz not null default now()
);

create index interview_prep_requests_candidate_idx on interview_prep_requests (candidate_id);

alter table interview_prep_requests enable row level security;

revoke all on interview_prep_requests from anon, authenticated;
grant select, insert on interview_prep_requests to authenticated;
grant all on interview_prep_requests to service_role;

create policy "candidates manage their own interview prep requests"
  on interview_prep_requests for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());
