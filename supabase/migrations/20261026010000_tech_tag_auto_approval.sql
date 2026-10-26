-- §job-import follow-up: a curated vocabulary always has long-tail gaps
-- (a real example: "VBA" wasn't in tech_tags at all) — and this project
-- has no admin panel to clear the existing manual-review backlog with.
-- Requests now resolve synchronously via an LLM validation step (see
-- src/lib/ai/validate-tech-tag.ts) instead of waiting for a human to
-- notice an email — these two columns are the audit trail for that,
-- not a gate: nothing blocks on them being reviewed.
alter table tech_tag_requests
  add column auto_approved boolean not null default false;
alter table tech_tag_requests
  add column resulting_tech_tag_id uuid references tech_tags(id) on delete set null;

-- Was a dedup key (bump a counter instead of a near-duplicate row) back
-- when a request could sit `pending` for a while. Every request now
-- resolves synchronously in the same call that creates it, so the same
-- normalized label can legitimately appear again later (re-requested
-- after a rejection, or logged independently by a different company) —
-- this is a historical log now, not a dedup table.
alter table tech_tag_requests drop constraint tech_tag_requests_normalized_label_key;
