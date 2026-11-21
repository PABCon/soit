-- Custom application stages: a new application needs a real stage_id at
-- insert time (now NOT NULL), and the one place applications actually
-- get inserted is this atomic RPC, not a plain .insert() call. The
-- caller (applyToJob/applyAnonymously) resolves the company's initial
-- stage id first (lazily creating the default pipeline if the company
-- has never customized one) and passes it straight through here.
--
-- Postgres functions are identified by name + parameter list together,
-- `create or replace` with an added parameter creates a second,
-- separate overload rather than replacing the original, so the old
-- 5-parameter version is dropped explicitly first. There's exactly one
-- real call site for this function in application code; leaving a
-- second overload around would just be a silently-uncallable trap for
-- a future caller who doesn't realize stage_id is now required.
drop function if exists public.insert_application_if_under_cap(uuid, uuid, text, text, int);

create or replace function public.insert_application_if_under_cap(
  p_candidate_id uuid,
  p_job_id uuid,
  p_cv_url text,
  p_cover_note text,
  p_daily_cap int,
  p_stage_id uuid
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

  insert into applications (job_id, candidate_id, cv_url, cover_note, stage_id)
  values (p_job_id, p_candidate_id, p_cv_url, nullif(trim(p_cover_note), ''), p_stage_id)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.insert_application_if_under_cap(uuid, uuid, text, text, int, uuid) to authenticated, service_role;
