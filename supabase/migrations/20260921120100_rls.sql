-- SóIT — Row Level Security (build spec §6)
--
-- RLS *is* the security model. Two surfaces share one database, so without
-- these policies any authenticated employer could read every other employer's
-- applicants and every CV in the system.
--
-- Shape: revoke the default blanket grants, grant precise privileges, then
-- constrain rows with policies. Column privileges do the work RLS cannot —
-- notably keeping companies.nif away from the public surface.

-- ── helpers ──────────────────────────────────────────────────────────────────
-- security definer + empty search_path, fully qualified. Written once and used
-- in every employer-scoped policy, so the membership rule lives in one place:
-- allowing multi-company membership later changes this function, not 12 policies.
create or replace function public.my_company_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select company_id from public.employer_users where auth_user_id = auth.uid()
$$;

create or replace function public.my_employer_role()
returns public.employer_role language sql stable security definer set search_path = '' as $$
  select role from public.employer_users where auth_user_id = auth.uid()
$$;

create or replace function public.my_candidate_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.candidates where auth_user_id = auth.uid()
$$;

-- The console's own company, including the columns the public may never read.
create or replace function public.my_company()
returns public.companies language sql stable security definer set search_path = '' as $$
  select c.* from public.companies c where c.id = public.my_company_id()
$$;

revoke all on function public.my_company_id, public.my_employer_role,
                      public.my_candidate_id, public.my_company from public;
grant execute on function public.my_company_id, public.my_employer_role,
                          public.my_candidate_id, public.my_company to authenticated;

-- ── deny by default ──────────────────────────────────────────────────────────
alter table companies        enable row level security;
alter table employer_users   enable row level security;
alter table employer_invites enable row level security;
alter table candidates       enable row level security;
alter table jobs             enable row level security;
alter table tech_tags        enable row level security;
alter table job_tech_tags    enable row level security;
alter table applications     enable row level security;
alter table events           enable row level security;

revoke all on companies, employer_users, employer_invites, candidates, jobs,
              tech_tags, job_tech_tags, applications, events
  from anon, authenticated;

-- ── companies ────────────────────────────────────────────────────────────────
-- Public may read the company page fields. NOT nif, and NOT the verification
-- columns — that is a column privilege, because RLS cannot restrict columns.
-- The console reads its own via public.my_company().
grant select (
  id, company_name, slug, company_logo_url, cover_image_url,
  company_description, website, industry, company_size, created_at
) on companies to anon, authenticated;

grant update (
  company_name, company_logo_url, cover_image_url,
  company_description, website, industry, company_size
) on companies to authenticated;

create policy "companies are publicly readable"
  on companies for select to anon, authenticated using (true);

create policy "owners update their own company"
  on companies for update to authenticated
  using (id = public.my_company_id() and public.my_employer_role() = 'owner')
  with check (id = public.my_company_id() and public.my_employer_role() = 'owner');

-- INSERT is deliberately absent: registration runs server-side with the
-- service role because it also starts NIF verification (§5.7.3).

-- ── employer_users ───────────────────────────────────────────────────────────
grant select on employer_users to authenticated;
grant insert, delete on employer_users to authenticated;

create policy "see colleagues"
  on employer_users for select to authenticated
  using (company_id = public.my_company_id());

create policy "owners add colleagues"
  on employer_users for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');

create policy "owners remove colleagues"
  on employer_users for delete to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner');

-- ── employer_invites ─────────────────────────────────────────────────────────
grant select, insert, update, delete on employer_invites to authenticated;

create policy "owners manage invites"
  on employer_invites for all to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner')
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');

-- ── candidates ───────────────────────────────────────────────────────────────
-- Employers never read this table. They reach applicant data only through
-- applications, and only for their own jobs.
grant select on candidates to authenticated;
grant update (full_name, phone, cv_url, linkedin_url, avatar_url, skills)
  on candidates to authenticated;

create policy "candidates read their own profile"
  on candidates for select to authenticated
  using (auth_user_id = auth.uid());

create policy "candidates update their own profile"
  on candidates for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- INSERT absent: apply runs server-side (§6.7) so the upload can be validated
-- and the profile created unclaimed.

-- ── jobs ─────────────────────────────────────────────────────────────────────
grant select on jobs to anon, authenticated;
grant insert, update, delete on jobs to authenticated;

-- The live condition (§5.5), the single definition used by feed, job page,
-- sitemap and JSON-LD.
create policy "live jobs are public"
  on jobs for select to anon, authenticated
  using (status = 'published' and expires_at > now());

create policy "employers see all their company's jobs"
  on jobs for select to authenticated
  using (company_id = public.my_company_id());

create policy "employers write their company's jobs"
  on jobs for insert to authenticated
  with check (company_id = public.my_company_id());

create policy "employers edit their company's jobs"
  on jobs for update to authenticated
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

create policy "employers delete their company's jobs"
  on jobs for delete to authenticated
  using (company_id = public.my_company_id());

-- ── tech vocabulary ──────────────────────────────────────────────────────────
grant select on tech_tags, job_tech_tags to anon, authenticated;
grant insert, delete on job_tech_tags to authenticated;

create policy "vocabulary is public"
  on tech_tags for select to anon, authenticated using (true);

create policy "job tags are public"
  on job_tech_tags for select to anon, authenticated using (true);

create policy "employers tag their company's jobs"
  on job_tech_tags for insert to authenticated
  with check (exists (
    select 1 from jobs j
    where j.id = job_tech_tags.job_id and j.company_id = public.my_company_id()
  ));

create policy "employers untag their company's jobs"
  on job_tech_tags for delete to authenticated
  using (exists (
    select 1 from jobs j
    where j.id = job_tech_tags.job_id and j.company_id = public.my_company_id()
  ));

-- tech_tags itself is service-role only: a vocabulary employers can extend is
-- a vocabulary that stops being one (§5.6).

-- ── applications ─────────────────────────────────────────────────────────────
-- The policy that matters most. It must join back through jobs.company_id,
-- never trust a client-supplied parameter.
grant select on applications to authenticated;
grant update (status) on applications to authenticated;

create policy "candidates see their own applications"
  on applications for select to authenticated
  using (candidate_id = public.my_candidate_id());

create policy "employers see applications to their company's jobs"
  on applications for select to authenticated
  using (exists (
    select 1 from jobs j
    where j.id = applications.job_id and j.company_id = public.my_company_id()
  ));

create policy "employers set status on their company's applications"
  on applications for update to authenticated
  using (exists (
    select 1 from jobs j
    where j.id = applications.job_id and j.company_id = public.my_company_id()
  ))
  with check (exists (
    select 1 from jobs j
    where j.id = applications.job_id and j.company_id = public.my_company_id()
  ));

-- Candidates deliberately cannot UPDATE: status belongs to the employer.
-- INSERT is server-side (§6.7).

-- ── events ───────────────────────────────────────────────────────────────────
-- RLS enabled, no policies, no grants: server-side inserts only (§6.2).

-- ── live_jobs view ───────────────────────────────────────────────────────────
-- security_invoker so the caller's RLS still applies; this is a convenience,
-- never a way around a policy.
create view live_jobs with (security_invoker = true) as
  select * from jobs where status = 'published' and expires_at > now();

grant select on live_jobs to anon, authenticated;
