-- Security audit finding (2026-10-28): the job-publish slot-cap check has
-- the exact same TOCTOU shape as the ad-credit race this project already
-- found and fixed once (20261009130000_atomic_ad_credit_decrement.sql) —
-- read `liveCount` in application code, decide in JS, write unconditionally,
-- with no re-check at write time. The pricing model moved from a credit
-- counter to "live-job-count vs. job_ad_slot_cap" since that earlier fix,
-- and the move silently reintroduced the same unguarded read-then-write
-- pattern — decrement_ad_credit itself is now unused (confirmed via a
-- repo-wide grep), orphaned by the redesign rather than superseded by an
-- equivalent. Two concurrent publish requests (two draft jobs, a
-- double-click, two tabs) can both read the same live count, both pass
-- `liveCount < slot_cap`, and both publish — exceeding what the company
-- actually paid for.
--
-- This function is the atomic replacement: the live-count recheck and the
-- publish-transition write happen inside one function call, serialized
-- per-company via a transaction-scoped advisory lock (released
-- automatically at the end of the call — never held across a network
-- round trip back to application code, unlike a naive two-step
-- check-then-write). `security definer` + a pinned `search_path`, same
-- posture as `decrement_ad_credit`, since this needs to count a company's
-- jobs regardless of which specific row's RLS context the caller holds.
create or replace function public.claim_job_publish_slot(
  p_job_id uuid,
  p_company_id uuid,
  p_slot_cap int,
  p_salary_public boolean,
  p_published_at timestamptz,
  p_expires_at timestamptz,
  p_boost_rank_at timestamptz,
  p_boosted_until timestamptz,
  p_bump_credits_remaining int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  live_count int;
  updated_rows int;
begin
  perform pg_advisory_xact_lock(hashtext(p_company_id::text));

  select count(*) into live_count
  from jobs
  where company_id = p_company_id
    and status = 'published'
    and expires_at > now()
    and id != p_job_id;

  if live_count >= p_slot_cap then
    return false;
  end if;

  update jobs
  set status = 'published',
      salary_public = p_salary_public,
      published_at = p_published_at,
      expires_at = p_expires_at,
      boost_rank_at = p_boost_rank_at,
      boosted_until = p_boosted_until,
      bump_credits_remaining = p_bump_credits_remaining
  where id = p_job_id and company_id = p_company_id;

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

grant execute on function public.claim_job_publish_slot(uuid, uuid, int, boolean, timestamptz, timestamptz, timestamptz, timestamptz, int) to authenticated, service_role;

-- Orphaned by the pricing-model redesign (counter-based credits -> live-
-- job-count-vs-cap) — confirmed zero callers anywhere in src/. Dropped
-- rather than left around unused and misleading about what actually
-- guards publishing now.
drop function if exists public.decrement_ad_credit(uuid);
