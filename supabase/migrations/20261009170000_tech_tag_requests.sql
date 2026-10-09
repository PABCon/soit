-- Real-usage QA item: the tech-tag vocabulary on job postings is a fixed,
-- curated relation (§5.6's own comment: "a relation, not a text[]" — on
-- purpose, to keep "React"/"ReactJS"/"react.js" from becoming three
-- different filter values). An employer who can't find their stack in
-- the list had no path forward at all before this — this table is that
-- path: "dedupe -> verify real -> add" from the QA note, where "verify
-- real" is a deliberate manual step (see requestTechTag()'s own doc
-- comment) rather than a new admin panel — this project has none yet,
-- and building one is a far bigger, unrelated lift.
create table tech_tag_requests (
  id                      uuid primary key default gen_random_uuid(),
  -- Dedup key: lowercased/trimmed, so "React Native", "react native",
  -- and " React Native " all collapse to one row with a growing
  -- request_count instead of five near-duplicates to sift through.
  normalized_label        text not null unique,
  -- As the first requester actually typed it — preserves real casing
  -- for whoever reviews this and adds it to tech_tags.
  requested_label         text not null,
  request_count           integer not null default 1,
  status                  text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by_company_id uuid references companies(id) on delete set null,
  created_at              timestamptz not null default now(),
  last_requested_at       timestamptz not null default now()
);

alter table tech_tag_requests enable row level security;

-- No authenticated grants at all: requestTechTag() needs to see every
-- company's requests to dedupe correctly (not just the caller's own),
-- so it runs entirely through the admin client after its own
-- getMyEmployerContext() check — the same shape as applyAnonymously's
-- cross-candidate rate-limit check in applications.ts.
grant all on tech_tag_requests to service_role;
