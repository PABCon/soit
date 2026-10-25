-- §pricing: job-ad packs move from one-time purchases to recurring Stripe
-- subscriptions (self-serve 1/3/5-style tiers, plus custom deals like a
-- 200-slot enterprise plan), generalizing `company_subscriptions` — until
-- now Top-Employer-only — to also carry job-ads subscriptions. The two
-- share the identical Stripe lifecycle (checkout.session.completed,
-- customer.subscription.updated/deleted); `plan_type` + `slot_cap` are
-- what let one webhook handler apply the right side effect for either.
alter table company_subscriptions
  add column plan_type text not null default 'top_employer'
    check (plan_type in ('top_employer', 'job_ads'));
alter table company_subscriptions
  add column slot_cap integer;

-- Replaces the old `ad_credits_available`-spend-down publish gate: how many
-- concurrent LIVE jobs this company may have right now — 1 by default
-- (every verified company's free baseline, unchanged), or whatever their
-- active job-ads subscription grants. Kept in sync by the Stripe webhook,
-- the same way `top_employer_active` already is. `ad_credits_available`
-- and `job_ad_purchases` are left in place (no real purchases exist against
-- them — confirmed live, test-mode-only data) but are no longer read by
-- the publish gate as of this migration.
alter table companies
  add column job_ad_slot_cap integer not null default 1 check (job_ad_slot_cap >= 1);

-- A company can now hold two independent subscriptions (job-ads + Top
-- Employer) — without a stable customer id, each new Checkout Session
-- would create a brand-new Stripe Customer, splitting one company's
-- billing across multiple Customers and breaking the Billing Portal (it's
-- scoped to one Customer). Set once, by the webhook, on first subscription;
-- every later checkout reuses it instead of letting Stripe mint a new one.
alter table companies
  add column stripe_customer_id text;
