-- SóIT — apply requires a candidate account (build spec §6.7, revised v1.10)
--
-- Step 2 left `applications` INSERT service-role-only, since apply was
-- originally account-free (anonymous submission, no caller to authorize
-- via RLS). v1.10 changed that: applying now requires a verified candidate
-- account, so the caller IS authenticated, and RLS can do the real
-- authorization — including the "job must be live" check §6.7 calls for,
-- which used to be application code and is now a database constraint.

grant insert on applications to authenticated;

create policy "candidates apply to live jobs"
  on applications for insert to authenticated
  with check (
    candidate_id = public.my_candidate_id()
    and exists (
      select 1 from jobs j
      where j.id = applications.job_id
        and j.status = 'published' and j.expires_at > now()
    )
  );
