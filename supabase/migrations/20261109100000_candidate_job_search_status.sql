-- Matchmaking rework: candidate job-search status, directly plugged into
-- the shared scoring engine (matching-scoring.ts) as a hard gate, same
-- shape as Phase 2's residence-location gate. Three states: 'looking'
-- (actively job-hunting), 'open' (not actively looking but receptive),
-- 'not_open' (not interested right now). A 'not_open' candidate is
-- excluded from both matching directions entirely (score forced to 0),
-- per the user's own explicit instruction.
--
-- Default 'open', not 'not_open': defaulting to the exclusionary value
-- would silently drop every existing candidate out of every employer's
-- matches the moment this column landed. 'open' preserves today's real
-- behavior for everyone until they explicitly say otherwise.

alter table candidates
  add column job_search_status text not null default 'open'
    check (job_search_status in ('looking', 'open', 'not_open'));

grant update (job_search_status) on candidates to authenticated;
