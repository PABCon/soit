-- Real-usage QA item: the applicant detail view had no summary at all —
-- just the raw cover note, skills chips, and a CV download link. An
-- employer reviewing a stack of applicants had to read every CV
-- themselves to judge fit. Stores the LLM-generated synopsis
-- ({ summary, strengths, gaps }) once per application rather than
-- regenerating on every page view — see generateApplicantSynopsis()'s
-- own doc comment for why this is an explicit, employer-triggered
-- action, not automatic.
alter table applications
  add column ai_synopsis jsonb;

-- No grant change needed: `grant select on applications to authenticated`
-- (20260921120000_schema.sql) is already unrestricted by column, so the
-- existing RLS-scoped read path picks this up for free. Only ever
-- written by the admin client after a real LLM call — same reasoning
-- `grant update (status)` being the only authenticated-writable column
-- already establishes: an employer never writes this column directly.
