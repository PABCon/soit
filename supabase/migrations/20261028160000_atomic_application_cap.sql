-- Security audit finding (2026-10-28): the per-candidate daily application
-- cap (DAILY_APPLICATION_CAP, applyToJob/applyAnonymously in
-- src/lib/db/applications.ts) has the same TOCTOU shape as every other
-- read-then-write race this pass found and fixed — count recent
-- applications, decide in JS, insert unconditionally. A real human can't
-- submit 20+ truly concurrent applications; a script deliberately
-- hammering the anonymous apply endpoint can, exceeding the cap by
-- however many requests land inside the race window. This is the atomic
-- replacement: the recount and the insert happen in one function call,
-- serialized per-candidate via a transaction-scoped advisory lock (same
-- pattern as claim_job_publish_slot). The existing `unique(job_id,
-- candidate_id)` double-apply constraint is untouched — a conflict there
-- still raises the same 23505 the caller already catches, since this
-- function doesn't swallow the exception.
create or replace function public.insert_application_if_under_cap(
  p_candidate_id uuid,
  p_job_id uuid,
  p_cv_url text,
  p_cover_note text,
  p_daily_cap int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_candidate_id::text));

  select count(*) into recent_count
  from applications
  where candidate_id = p_candidate_id
    and created_at > now() - interval '24 hours';

  if recent_count >= p_daily_cap then
    return null;
  end if;

  insert into applications (job_id, candidate_id, cv_url, cover_note)
  values (p_job_id, p_candidate_id, p_cv_url, nullif(trim(p_cover_note), ''))
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.insert_application_if_under_cap(uuid, uuid, text, text, int) to authenticated, service_role;
