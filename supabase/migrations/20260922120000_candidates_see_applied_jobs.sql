-- SóIT — a candidate can always see a job they applied to (build step 6/7)
--
-- "live jobs are public" only covers status='published' AND expires_at >
-- now(). Without this, a candidate's own Applications dashboard would
-- silently lose the job title/company the moment that job expires, is
-- closed, or the employer pauses it — even though the candidate's
-- application to it is still very much real and still shown in their
-- history. Scoped the same way "employers see applications to their
-- company's jobs" is: via the applications row that proves the
-- relationship, never a blanket grant.

create policy "candidates see jobs they applied to"
  on jobs for select to authenticated
  using (exists (
    select 1 from applications a
    where a.job_id = jobs.id and a.candidate_id = public.my_candidate_id()
  ));
