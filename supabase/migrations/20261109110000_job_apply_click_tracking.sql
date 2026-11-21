-- Employer analytics, phase 1: apply-button click tracking, same shape
-- as the existing view_count (20261012100000_job_view_count.sql) —
-- a real production metric to show employers ("how many people clicked
-- apply"), distinct from completed applications, which are already
-- counted via the applications table.
alter table public.jobs add column apply_click_count integer not null default 0;

-- Both counters now also write a timestamped row to `events` (already
-- existed, "nothing consumes it yet" per logEvent's own doc comment) —
-- the plain integer counter alone has no history, only a running total,
-- but the employer analytics trend needs "views per day over the last
-- 30 days." The existing (type, created_at desc) index on events is
-- already exactly shaped for this. company_id is looked up and stored
-- in the payload at write time (not left to a join at read time), since
-- a dashboard load scans events by company across potentially many
-- jobs and a stored column beats re-deriving it from jobs on every read.
create or replace function public.increment_job_view(target_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job_company_id uuid;
begin
  update jobs
  set view_count = view_count + 1
  where id = target_job_id
  returning company_id into job_company_id;

  if job_company_id is not null then
    insert into events (type, payload)
    values ('job.viewed', jsonb_build_object('job_id', target_job_id, 'company_id', job_company_id));
  end if;
end;
$$;

create or replace function public.increment_job_apply_click(target_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job_company_id uuid;
begin
  update jobs
  set apply_click_count = apply_click_count + 1
  where id = target_job_id
  returning company_id into job_company_id;

  if job_company_id is not null then
    insert into events (type, payload)
    values ('job.apply_clicked', jsonb_build_object('job_id', target_job_id, 'company_id', job_company_id));
  end if;
end;
$$;

-- Called only via the admin client from a server-side route handler
-- (POST /api/jobs/[id]/apply-click), same posture as increment_job_view.
grant execute on function public.increment_job_apply_click(uuid) to service_role;
