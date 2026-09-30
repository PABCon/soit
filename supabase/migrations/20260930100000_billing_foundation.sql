-- Employer pricing & billing, phase 1 (§AI Pieces backlog's pricing item,
-- finally resolved after a real business-model pass): job-ad credits
-- (one-time Stripe Checkout purchases) and the Top Employer subscription's
-- data-model foundations, plus the columns the publish-gate rewrite and
-- the bump/boost mechanic need on `jobs`.
--
-- Billing columns on `companies` follow the exact same treatment as `nif`/
-- the verification_* columns (20260921120100_rls.sql): deliberately absent
-- from both the public and the broad `authenticated` column grants, so
-- they're readable only through `my_company()` (already SECURITY DEFINER,
-- already granted execute to authenticated) — never via the public "using
-- (true)" row policy on `companies`. Only the service role (the Stripe
-- webhook, via the admin client) ever writes them.

alter table companies
  add column ad_credits_available integer not null default 0
    check (ad_credits_available >= 0),
  add column top_employer_active boolean not null default false,
  add column top_employer_period_end timestamptz;

alter table jobs
  add column salary_public boolean not null default true,
  add column boost_rank_at timestamptz,
  add column boosted_until timestamptz,
  add column bump_credits_remaining integer not null default 0
    check (bump_credits_remaining >= 0);

-- Backfill existing live/past jobs so the new sort key isn't null for
-- anything already published.
update jobs set boost_rank_at = published_at where published_at is not null;

-- salary_public follows the same "public may read some columns" shape as
-- every other job field — no special column grant needed, just app-layer
-- logic (saveJob()) never letting a free-tier job set it false, and every
-- read path (getLiveJobs/getLiveJobBySlug/getBrowseJobs/JSON-LD) omitting
-- salary_min/max from what's sent to the client when it's false.
-- boost_rank_at/boosted_until/bump_credits_remaining are operational, not
-- secret — safe to read publicly (needed for the feed's own sort/badge),
-- so they're added to the same column grant jobs' other fields already use.
grant select (
  salary_public, boost_rank_at, boosted_until, bump_credits_remaining
) on jobs to anon, authenticated;

-- ── job_ad_purchases ─────────────────────────────────────────────────────────
-- Audit ledger for one-time ad-credit purchases. Same shape as `events`
-- (RLS enabled, written only by the service role) plus one read policy so
-- a company can see its own purchase history.
create table job_ad_purchases (
  id                          uuid primary key default gen_random_uuid(),
  company_id                  uuid not null references companies(id) on delete cascade,
  stripe_checkout_session_id  text not null,
  stripe_payment_intent_id    text,
  quantity                    integer not null check (quantity > 0),
  unit_price_cents            integer not null check (unit_price_cents > 0),
  total_cents                 integer not null check (total_cents > 0),
  currency                    text not null default 'eur',
  created_at                  timestamptz not null default now()
);
create index job_ad_purchases_company_idx on job_ad_purchases (company_id);
create unique index job_ad_purchases_session_idx on job_ad_purchases (stripe_checkout_session_id);

alter table job_ad_purchases enable row level security;
grant select on job_ad_purchases to authenticated;
grant all on job_ad_purchases to service_role;

create policy "employers see their own ad purchases"
  on job_ad_purchases for select to authenticated
  using (company_id = public.my_company_id());

-- ── company_subscriptions ────────────────────────────────────────────────────
-- Top Employer lifecycle audit trail. `companies.top_employer_active`/
-- `top_employer_period_end` are the fast, denormalized read path (checked
-- on every publish-gate call); this table is the source of truth the
-- webhook reconciles them from, and what a company can see of its own
-- billing history.
create table company_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(id) on delete cascade,
  stripe_customer_id      text not null,
  stripe_subscription_id  text not null,
  status                  text not null,
  billing_interval        text not null check (billing_interval in ('month', 'year')),
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index company_subscriptions_company_idx on company_subscriptions (company_id);
create unique index company_subscriptions_stripe_sub_idx on company_subscriptions (stripe_subscription_id);

alter table company_subscriptions enable row level security;
grant select on company_subscriptions to authenticated;
grant all on company_subscriptions to service_role;

create policy "employers see their own subscription"
  on company_subscriptions for select to authenticated
  using (company_id = public.my_company_id());
