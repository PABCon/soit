-- SóIT — a candidate can always see a job they favorited (phase 3 of
-- real-usage QA round 3), even once it's no longer live — same reasoning,
-- and same SECURITY DEFINER shape, as candidate_applied_to_job() /
-- "candidates see jobs they applied to": without this, a saved job would
-- silently vanish from Favorites the moment it expires or the employer
-- pauses it, exactly the applications precedent this mirrors. Written as a
-- SECURITY DEFINER function from the start rather than a raw correlated
-- subquery — jobs->favorites is one-directional here (favorites' own
-- policy never reads from jobs, so there's no cycle), but this is the
-- established, already-proven-safe pattern in this codebase for exactly
-- this class of check, and there's no reason to deviate from it.

create or replace function public.candidate_favorited_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.favorites f
    where f.job_id = p_job_id and f.candidate_id = public.my_candidate_id()
  )
$$;

revoke all on function public.candidate_favorited_job from public;
grant execute on function public.candidate_favorited_job to authenticated;

create policy "candidates see jobs they favorited"
  on jobs for select to authenticated
  using (public.candidate_favorited_job(jobs.id));
