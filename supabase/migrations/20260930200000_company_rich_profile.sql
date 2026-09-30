-- Top Employer's rich company profile (billing phase 3).
--
-- The pricing page has sold "Full rich company profile" as a Top Employer
-- perk since phase 2 shipped. This migration builds the real columns/tables
-- behind that copy. Gating is NOT done with RLS or a column grant trick:
-- these fields are public-profile content like every other company field,
-- readable the same way once a company has them. Gating instead happens in
-- application code (`getCompanyBySlug` only returns them when
-- `top_employer_active` is true) — same reasoning as the console-side
-- blur-and-tease mechanic, which is a sales tactic, not an access control.

alter table companies
  add column about_us_text        text,
  add column how_we_work_text     text,
  add column benefits_text        text,
  add column custom_section_title text,
  add column custom_section_body  text;

-- Same gotcha this project has hit before: GRANT is column-additive, a new
-- column is silently unreadable under RLS without its own grant.
grant select (
  about_us_text, how_we_work_text, benefits_text,
  custom_section_title, custom_section_body
) on companies to anon, authenticated;

grant update (
  about_us_text, how_we_work_text, benefits_text,
  custom_section_title, custom_section_body
) on companies to authenticated;

-- Four child tables, same shape/conventions as candidate_experience /
-- candidate_certifications (20260929140000): no explicit `position` column,
-- order is array order via delete-then-reinsert on save + `order by
-- created_at asc` on read. Owner-only write, public read (this is public
-- profile content, not private data).

create table company_team_members (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name       text not null,
  role       text,
  created_at timestamptz not null default now()
);
create index company_team_members_company_idx on company_team_members (company_id);

alter table company_team_members enable row level security;
grant select on company_team_members to anon, authenticated;
grant insert, update, delete on company_team_members to authenticated;
grant all on company_team_members to service_role;

create policy "team members are publicly readable"
  on company_team_members for select to anon, authenticated using (true);

create policy "owners manage their own team members"
  on company_team_members for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
create policy "owners update their own team members"
  on company_team_members for update to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner')
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
create policy "owners delete their own team members"
  on company_team_members for delete to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner');

create table company_testimonials (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name       text not null,
  role       text,
  quote      text not null,
  created_at timestamptz not null default now()
);
create index company_testimonials_company_idx on company_testimonials (company_id);

alter table company_testimonials enable row level security;
grant select on company_testimonials to anon, authenticated;
grant insert, update, delete on company_testimonials to authenticated;
grant all on company_testimonials to service_role;

create policy "testimonials are publicly readable"
  on company_testimonials for select to anon, authenticated using (true);

create policy "owners manage their own testimonials"
  on company_testimonials for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
create policy "owners update their own testimonials"
  on company_testimonials for update to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner')
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
create policy "owners delete their own testimonials"
  on company_testimonials for delete to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner');

-- Photo gallery: rows are inserted one at a time (upload-then-insert), not
-- delete-then-reinsert like the other three — see uploadGalleryPhotoAction.
create table company_gallery_photos (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  url        text not null,
  created_at timestamptz not null default now()
);
create index company_gallery_photos_company_idx on company_gallery_photos (company_id);

alter table company_gallery_photos enable row level security;
grant select on company_gallery_photos to anon, authenticated;
grant insert, delete on company_gallery_photos to authenticated;
grant all on company_gallery_photos to service_role;

create policy "gallery photos are publicly readable"
  on company_gallery_photos for select to anon, authenticated using (true);

create policy "owners manage their own gallery photos"
  on company_gallery_photos for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
create policy "owners delete their own gallery photos"
  on company_gallery_photos for delete to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner');

create table company_gallery_videos (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title      text not null,
  url        text not null,
  created_at timestamptz not null default now()
);
create index company_gallery_videos_company_idx on company_gallery_videos (company_id);

alter table company_gallery_videos enable row level security;
grant select on company_gallery_videos to anon, authenticated;
grant insert, update, delete on company_gallery_videos to authenticated;
grant all on company_gallery_videos to service_role;

create policy "gallery videos are publicly readable"
  on company_gallery_videos for select to anon, authenticated using (true);

create policy "owners manage their own gallery videos"
  on company_gallery_videos for insert to authenticated
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
create policy "owners update their own gallery videos"
  on company_gallery_videos for update to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner')
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
create policy "owners delete their own gallery videos"
  on company_gallery_videos for delete to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
