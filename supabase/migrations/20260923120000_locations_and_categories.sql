-- SóIT — job browse pages: location + category taxonomies (real-usage QA
-- + your data-hygiene call: neither should be free text on the posting
-- form any more).

-- ── locations ────────────────────────────────────────────────────────────────
-- Curated Portuguese cities, seeded with known coordinates so posting a job
-- no longer needs a per-job Nominatim geocoding call (src/lib/geocode.ts —
-- removed alongside this migration).
create table locations (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  latitude   double precision not null,
  longitude  double precision not null,
  created_at timestamptz not null default now()
);
alter table locations enable row level security;
grant select on locations to anon, authenticated;
create policy "locations are publicly readable"
  on locations for select to anon, authenticated using (true);

insert into locations (slug, name, latitude, longitude) values
  ('lisboa', 'Lisboa', 38.7223, -9.1393),
  ('porto', 'Porto', 41.1579, -8.6291),
  ('braga', 'Braga', 41.5454, -8.4265),
  ('coimbra', 'Coimbra', 40.2033, -8.4103),
  ('aveiro', 'Aveiro', 40.6405, -8.6538),
  ('faro', 'Faro', 37.0194, -7.9304),
  ('setubal', 'Setúbal', 38.5244, -8.8882),
  ('leiria', 'Leiria', 39.7436, -8.8071),
  ('guimaraes', 'Guimarães', 41.4425, -8.2918),
  ('viseu', 'Viseu', 40.6566, -7.9122),
  ('evora', 'Évora', 38.5714, -7.9135),
  ('viana-do-castelo', 'Viana do Castelo', 41.6932, -8.8330),
  ('funchal', 'Funchal', 32.6669, -16.9241),
  ('ponta-delgada', 'Ponta Delgada', 37.7412, -25.6756)
on conflict (slug) do nothing;

alter table jobs add column location_id uuid references locations(id) on delete set null;
create index jobs_location_id_idx on jobs (location_id);

-- Best-effort backfill for existing free-text rows (the live DB has only a
-- couple of real rows today) — case-insensitive name match.
update jobs set location_id = locations.id
from locations
where jobs.location_id is null
  and jobs.location is not null
  and lower(trim(jobs.location)) = lower(locations.name);

-- ── job_categories ───────────────────────────────────────────────────────────
-- Job function/domain — distinct from tech_tags (specific technologies,
-- unbounded per job): one broad category per job, same hygiene reasoning
-- as locations. Adapted from tech_tags' own seed-file section groupings
-- (supabase/seed.sql) reshaped into job functions.
create table job_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  created_at timestamptz not null default now()
);
alter table job_categories enable row level security;
grant select on job_categories to anon, authenticated;
create policy "job categories are publicly readable"
  on job_categories for select to anon, authenticated using (true);

insert into job_categories (slug, label) values
  ('software-development', 'Software Development'),
  ('frontend-development', 'Frontend Development'),
  ('backend-development', 'Backend Development'),
  ('mobile-development', 'Mobile Development'),
  ('devops-cloud', 'DevOps & Cloud Infrastructure'),
  ('data-analytics', 'Data & Analytics'),
  ('ai-ml', 'AI & Machine Learning'),
  ('qa-testing', 'QA & Testing'),
  ('cybersecurity', 'Cybersecurity'),
  ('it-support', 'IT Support & Systems Administration'),
  ('enterprise-systems', 'Enterprise Systems'),
  ('product-management', 'Product Management'),
  ('ux-ui-design', 'UX/UI Design'),
  ('project-management', 'Project/Program Management')
on conflict (slug) do nothing;

alter table jobs add column category_id uuid references job_categories(id);
create index jobs_category_id_idx on jobs (category_id);
-- No free-text twin to backfill category from — nothing in the existing
-- data to derive it. Left null on old rows; required going forward via
-- JobForm.
