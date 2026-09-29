-- Real-usage finding (running a genuine functional/commercial CV through
-- the new CV-autofill feature): tech_tags' 159 entries are 100% technical
-- (languages, frameworks, tools, a few process terms) — zero coverage of
-- the commercial/functional roles that genuinely exist on an IT-sector job
-- board (job_categories already has product-management/project-management
-- as real categories, so the platform's own scope already anticipates
-- this; the tag vocabulary just never caught up). A bounded, curated round
-- of functional skills, not an open-ended dump — matches what a real
-- justjoin.it profile showed (Business Development, Nearshore Delivery,
-- Stakeholder Engagement, Recruitment Strategy, etc.).

insert into tech_tags (slug, label) values
  -- Sales / business development
  ('business-development', 'Business Development'),
  ('sales', 'Sales'),
  ('account-management', 'Account Management'),
  ('client-relationship-management', 'Client Relationship Management'),
  ('lead-generation', 'Lead Generation'),
  ('b2b-sales', 'B2B Sales'),
  ('pre-sales', 'Pre-Sales'),
  ('contract-negotiation', 'Contract Negotiation'),
  ('partnerships', 'Partnerships'),
  ('sales-strategy', 'Sales Strategy'),
  -- Recruitment / talent
  ('recruitment', 'Recruitment'),
  ('it-recruitment', 'IT Recruitment'),
  ('talent-acquisition', 'Talent Acquisition'),
  ('sourcing', 'Sourcing'),
  ('onboarding', 'Onboarding'),
  ('employer-branding', 'Employer Branding'),
  ('hr', 'HR'),
  ('interviewing', 'Interviewing'),
  -- Delivery / staffing / consulting
  ('it-staff-augmentation', 'IT Staff Augmentation'),
  ('nearshore-delivery', 'Nearshore Delivery'),
  ('delivery-management', 'Delivery Management'),
  ('resource-management', 'Resource Management'),
  ('vendor-management', 'Vendor Management'),
  ('consulting', 'Consulting'),
  ('stakeholder-management', 'Stakeholder Management'),
  ('stakeholder-engagement', 'Stakeholder Engagement'),
  ('change-management', 'Change Management'),
  -- Marketing
  ('digital-marketing', 'Digital Marketing'),
  ('content-marketing', 'Content Marketing'),
  ('seo', 'SEO'),
  ('marketing-strategy', 'Marketing Strategy'),
  ('brand-strategy', 'Brand Strategy'),
  ('social-media-marketing', 'Social Media Marketing'),
  ('copywriting', 'Copywriting'),
  -- General leadership/process not already covered (Agile/Scrum/Kanban/
  -- Leadership/TDD/DDD already exist — these are deliberately distinct)
  ('negotiation', 'Negotiation'),
  ('mentoring', 'Mentoring'),
  ('team-leadership', 'Team Leadership'),
  ('public-speaking', 'Public Speaking'),
  ('process-optimisation', 'Process Optimisation'),
  ('people-management', 'People Management')
on conflict (slug) do nothing;

-- ── skill_suggestions ────────────────────────────────────────────────────────
-- Companion fix: rather than guess at every future gap the way this
-- migration's own list had to, track every CV-parse skill/language label
-- that *didn't* match the real vocab, with an occurrence count — the seed
-- data for a future admin panel's "review pending tags" screen (§ go-live
-- checklist). Server-side only, same shape as `events`: RLS enabled, no
-- policies, no client grants — a candidate's own CV upload should never
-- give them visibility into (or write access to) this aggregate table.
create table skill_suggestions (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  label_norm    text generated always as (lower(trim(label))) stored,
  kind          text not null check (kind in ('skill', 'language')),
  occurrences   integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  reviewed      boolean not null default false
);
create unique index skill_suggestions_label_norm_kind_idx on skill_suggestions (label_norm, kind);
create index skill_suggestions_occurrences_idx on skill_suggestions (occurrences desc) where not reviewed;

alter table skill_suggestions enable row level security;
grant all on skill_suggestions to service_role;
