-- SóIT — fix infinite recursion between jobs and applications RLS policies
--
-- "candidates see jobs they applied to" (jobs) subqueries applications;
-- "employers see applications to their company's jobs" (applications)
-- subqueries jobs. A correlated subquery inside a USING clause still goes
-- through the target table's own RLS, so evaluating one re-triggers the
-- other — 42P17 infinite recursion. Fixed the same way my_company_id()
-- and my_candidate_id() already solve this exact class of problem:
-- SECURITY DEFINER breaks the cycle by running the inner check with the
-- function owner's privileges, bypassing applications' RLS instead of
-- re-entering it.

drop policy if exists "candidates see jobs they applied to" on jobs;

create or replace function public.candidate_applied_to_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.job_id = p_job_id and a.candidate_id = public.my_candidate_id()
  )
$$;

revoke all on function public.candidate_applied_to_job from public;
grant execute on function public.candidate_applied_to_job to authenticated;

create policy "candidates see jobs they applied to"
  on jobs for select to authenticated
  using (public.candidate_applied_to_job(jobs.id));
