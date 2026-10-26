-- "Claim your profile" outreach flow: a pre-built company profile + draft
-- job(s), scraped before anyone from that company has ever signed up, that
-- a prospect can claim via a one-time link instead of registering from
-- scratch. Two pieces:
--
-- 1. A `companies` row can now exist in a genuinely new state — `nif`
--    becomes nullable (an unclaimed shell has no owner yet to have
--    provided one), and a new `unclaimed` verification_status value keeps
--    these rows unambiguous from a real in-progress registration
--    (`unverified` already means something specific: a real signup that
--    submitted a NIF and is waiting on VIES/nif.pt). The existing
--    `check (nif ~ '^[0-9]{9}$')` already passes vacuously on NULL
--    (Postgres CHECK constraints only reject FALSE, not NULL — same
--    reasoning already used for jobs.salary_min/max going nullable for
--    drafts), so no constraint rewrite is needed there.
--
-- 2. `company_claim_invites` — one unguessable token per unclaimed company,
--    the thing actually emailed to a prospect. Service-role only, same
--    posture as `events`/`job_ad_purchases`: no authenticated owner exists
--    for an unclaimed company to grant access to, so both creating an
--    invite (the operator, via the admin client) and resolving one by
--    token (the public claim page, also via the admin client — same
--    pattern `employer_invites`' own token lookup already uses despite
--    THAT table having an authenticated-only policy, because the visitor
--    clicking the link isn't authenticated as the company either) go
--    through the admin client, never RLS.

alter table companies alter column nif drop not null;
alter type verification_status add value 'unclaimed';

create table company_claim_invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  token       text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  claimed_at  timestamptz,
  claimed_by  uuid references auth.users(id) on delete set null
);

create index company_claim_invites_company_id_idx on company_claim_invites (company_id);

alter table company_claim_invites enable row level security;
-- No policies — service role (the admin client) only, deliberately. See the
-- header comment above for why this doesn't need an authenticated policy
-- the way employer_invites does.

grant all on company_claim_invites to service_role;
