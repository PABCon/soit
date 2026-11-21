-- Employer-customizable hiring-pipeline stages, replacing the fixed
-- application_status enum's role in the UI going forward. The enum
-- column itself (applications.status) is left untouched, a frozen
-- historical record, same "dead but correct, not ripped out" precedent
-- this project already has for other superseded code.
--
-- Every company gets its own ordered list of stages; a new application
-- always starts on whichever stage has the lowest `position` for that
-- company, no separate "is default" flag needed, simpler to keep
-- correct than enforcing "exactly one flagged row" per company.
--
-- `candidate_bucket` is the one thing every custom stage is required to
-- map onto: candidates never see a company's own internal stage label
-- (which could be overly specific, or simply unprofessional out of
-- context, e.g. "Reject, weak communication"), only ever one of these
-- four small, universal, candidate-facing buckets, kept consistent
-- across every company on the platform. This is a deliberate, explicit
-- product requirement, not a nice-to-have default: a candidate must
-- always be able to see where their application genuinely stands,
-- regardless of how a company organizes its own internal process.
create table company_application_stages (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  label            text not null,
  position         integer not null,
  candidate_bucket text not null check (candidate_bucket in ('submitted', 'in_review', 'not_selected', 'hired')),
  created_at       timestamptz not null default now()
);
create index company_application_stages_company_idx on company_application_stages (company_id, position);

alter table applications
  add column stage_id uuid references company_application_stages(id),
  -- Decoupled from the stage entirely, on purpose: this is the simple
  -- read-receipt the candidate-visibility promise depends on ("has an
  -- employer actually looked at this application yet"), and it has to
  -- keep working no matter how a company renames, reorders, or deletes
  -- their own stages, so it can never be tied to any specific stage
  -- existing.
  add column viewed_at timestamptz;

alter table company_application_stages enable row level security;
grant select, insert, update, delete on company_application_stages to authenticated;
create policy "employers manage their own stages"
  on company_application_stages for all to authenticated
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
grant all on company_application_stages to service_role;

-- Column-level grants are additive, not inherited from a table-wide
-- grant (the exact gotcha this project has hit before), the existing
-- `grant update (status) on applications` from the original schema
-- migration doesn't cover these two new columns on its own.
grant update (stage_id, viewed_at) on applications to authenticated;

-- Seed every existing company's default 4-stage pipeline (mirroring
-- the old fixed enum exactly, minus 'viewed', which becomes viewed_at
-- instead), then backfill every existing application onto it.
do $$
declare
  c record;
  applied_id uuid;
  responded_id uuid;
  rejected_id uuid;
  closed_id uuid;
begin
  for c in select id from companies loop
    insert into company_application_stages (company_id, label, position, candidate_bucket)
    values (c.id, 'Applied', 0, 'submitted') returning id into applied_id;
    insert into company_application_stages (company_id, label, position, candidate_bucket)
    values (c.id, 'Responded', 1, 'in_review') returning id into responded_id;
    insert into company_application_stages (company_id, label, position, candidate_bucket)
    values (c.id, 'Rejected', 2, 'not_selected') returning id into rejected_id;
    insert into company_application_stages (company_id, label, position, candidate_bucket)
    values (c.id, 'Closed', 3, 'not_selected') returning id into closed_id;

    update applications a
    set
      stage_id = case a.status
        when 'applied' then applied_id
        when 'viewed' then applied_id
        when 'responded' then responded_id
        when 'rejected' then rejected_id
        when 'closed' then closed_id
      end,
      viewed_at = case when a.status <> 'applied' then a.status_updated_at else null end
    from jobs j
    where a.job_id = j.id and j.company_id = c.id;
  end loop;
end $$;
