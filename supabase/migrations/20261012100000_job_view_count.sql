-- Round 22: real per-job view tracking for the console "My job ads" list.
-- A naive read-then-write increment from application code is the exact
-- TOCTOU race this project already found and fixed once for ad credits
-- (20261009130000_atomic_ad_credit_decrement.sql) — same fix here, an
-- atomic increment computed inside a single UPDATE statement.
alter table public.jobs add column view_count integer not null default 0;

create or replace function public.increment_job_view(target_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update jobs
  set view_count = view_count + 1
  where id = target_job_id;
end;
$$;

-- Called only via the admin client from a server-side route handler
-- (POST /api/jobs/[id]/view) — never granted to anon/authenticated, so
-- the only way to invoke this is through that route, not a direct
-- PostgREST RPC call from a browser.
grant execute on function public.increment_job_view(uuid) to service_role;
