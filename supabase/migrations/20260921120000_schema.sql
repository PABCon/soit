-- SóIT — initial schema (build spec §5)
--
-- Two rules are enforced here, not in application code:
--   1. Salary is mandatory and unambiguous: min, max, period and employment
--      type are NOT NULL (§5.2).
--   2. Employers are companies, verified by NIF (§5.7).

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── enums ────────────────────────────────────────────────────────────────────
create type verification_status as enum ('unverified','pending','verified','failed');
create type verification_source as enum ('vies','provider','manual');
create type employer_role       as enum ('owner','member');
create type auth_provider       as enum ('email','google','linkedin','github','facebook');
create type seniority           as enum ('junior','mid','senior','lead');
create type work_model          as enum ('remote','hybrid','office');
create type salary_period       as enum ('hour','day','month','year');
create type employment_type     as enum ('permanent','fixed_term','contractor','freelance','internship');
-- No 'expired': expiry is the computed condition status='published' AND
-- expires_at > now() (§5.5). A stored flag would need a cron and could drift.
create type job_status          as enum ('draft','published','inactive','closed');
create type job_language        as enum ('pt','en');
create type application_status  as enum ('applied','viewed','responded','rejected','closed');

-- ── companies (§5.1) ─────────────────────────────────────────────────────────
create table companies (
  id                      uuid primary key default gen_random_uuid(),
  company_name            text not null check (length(trim(company_name)) > 0),
  slug                    text not null unique,

  -- Identity. Belongs to the company, never to a user (§5.7).
  nif                     char(9) not null unique check (nif ~ '^[0-9]{9}$'),
  nif_country             text not null default 'PT',
  verification_status     verification_status not null default 'unverified',
  verified_legal_name     text,
  verified_at             timestamptz,
  verification_source     verification_source,
  verification_reference  text,

  company_logo_url        text,
  cover_image_url         text,
  company_description     text,
  website                 text,
  industry                text,
  company_size            text,
  created_at              timestamptz not null default now()
);

comment on column companies.nif is
  'Portuguese NIF/NIPC. Personal data when it belongs to a sole trader — never exposed publicly (§6.6).';

-- ── employer_users (§5.1) ────────────────────────────────────────────────────
-- One person belongs to one company in the MVP. Lifting that is additive.
create table employer_users (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid not null unique references auth.users(id) on delete cascade,
  company_id         uuid not null references companies(id) on delete restrict,
  role               employer_role not null default 'member',
  invited_by         uuid references employer_users(id) on delete set null,
  invite_accepted_at timestamptz,
  created_at         timestamptz not null default now()
);
create index employer_users_company_idx on employer_users (company_id);

-- Every company must keep at least one owner; enforced in application code on
-- removal, since a constraint here would block the first insert.

create table employer_invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  email       citext not null,
  role        employer_role not null default 'member',
  token       text not null unique,
  invited_by  uuid references employer_users(id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (company_id, email)
);

-- ── candidates (§5.3) ────────────────────────────────────────────────────────
-- auth_user_id is nullable: the profile is created on apply, before any
-- password or social account exists. It is linked only after the email is
-- verified (§6.5) — otherwise anyone could apply with a stranger's address
-- and that stranger would inherit the application history.
create table candidates (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique references auth.users(id) on delete set null,
  full_name      text not null check (length(trim(full_name)) > 0),
  email          citext not null unique,
  phone          text,
  cv_url         text,
  linkedin_url   text,
  avatar_url     text,
  auth_provider  auth_provider,
  email_verified boolean not null default false,
  skills         text[] not null default '{}',
  created_at     timestamptz not null default now(),

  -- A profile may only be linked to an auth user once its email is verified.
  constraint claimed_profiles_are_verified
    check (auth_user_id is null or email_verified)
);

-- ── tech vocabulary (§5.6) ───────────────────────────────────────────────────
-- A relation, not a text[]: free text makes "React"/"ReactJS"/"react.js" three
-- different filter values, and fixing that later would be a migration.
create table tech_tags (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  aliases    text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ── jobs (§5.2) ──────────────────────────────────────────────────────────────
create table jobs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete restrict,
  created_by       uuid references employer_users(id) on delete set null,
  slug             text not null unique,

  title            text not null check (length(trim(title)) > 0),
  description      text not null,
  language         job_language not null,
  seniority        seniority not null,
  work_model       work_model not null,

  location         text,
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),

  -- The product's defining rule: no listing without a salary range (§1).
  salary_min       integer not null check (salary_min > 0),
  salary_max       integer not null check (salary_max > 0),
  salary_currency  text not null default 'EUR',
  salary_period    salary_period not null default 'month',
  salary_months    integer check (salary_months between 12 and 14),
  employment_type  employment_type not null,

  status           job_status not null default 'draft',
  published_at     timestamptz,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint salary_range_ordered check (salary_max >= salary_min),
  -- salary_months only means anything for a monthly range.
  constraint months_only_for_monthly
    check (salary_period = 'month' or salary_months is null),
  -- A published job must be dateable: validThrough is required by Google for
  -- Jobs, and the live condition (§5.5) depends on expires_at.
  constraint published_jobs_are_dated
    check (status <> 'published' or (published_at is not null and expires_at is not null)),
  -- Remote jobs have no coordinate; we never invent one (§8).
  constraint coordinates_are_paired
    check ((latitude is null) = (longitude is null))
);

create index jobs_live_idx      on jobs (status, expires_at desc);
create index jobs_company_idx   on jobs (company_id);
create index jobs_coords_idx    on jobs (latitude, longitude) where latitude is not null;
create index jobs_salary_idx    on jobs (salary_period, salary_min);

create table job_tech_tags (
  job_id      uuid not null references jobs(id) on delete cascade,
  tech_tag_id uuid not null references tech_tags(id) on delete restrict,
  primary key (job_id, tech_tag_id)
);
create index job_tech_tags_tag_idx on job_tech_tags (tech_tag_id);

-- ── applications (§5.4) ──────────────────────────────────────────────────────
create table applications (
  id                uuid primary key default gen_random_uuid(),
  -- RESTRICT: deleting a job must not erase candidates' application history
  -- (§15.1). Close the ad instead.
  job_id            uuid not null references jobs(id) on delete restrict,
  candidate_id      uuid not null references candidates(id) on delete cascade,
  cv_url            text not null,          -- snapshot; never overwritten by profile edits
  cover_note        text,
  status            application_status not null default 'applied',
  created_at        timestamptz not null default now(),
  status_updated_at timestamptz not null default now(),

  -- One application per candidate per job. Without this nothing stops fifty.
  unique (job_id, candidate_id)
);
create index applications_job_idx       on applications (job_id);
create index applications_candidate_idx on applications (candidate_id);

-- ── events (§12.2) ───────────────────────────────────────────────────────────
-- Every comms hook writes here even though nothing consumes it yet. An event
-- with no sink is dead code; one table makes it real and gives analytics now.
create table events (
  id         bigint generated always as identity primary key,
  type       text not null,
  payload    jsonb not null default '{}',
  actor_id   uuid,
  created_at timestamptz not null default now()
);
create index events_type_idx on events (type, created_at desc);

-- ── triggers ─────────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger jobs_updated_at before update on jobs
  for each row execute function set_updated_at();

create or replace function set_status_updated_at() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.status_updated_at = now();
  end if;
  return new;
end $$;

create trigger applications_status_updated_at before update on applications
  for each row execute function set_status_updated_at();
