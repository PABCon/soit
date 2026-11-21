-- Confirmed via direct query after the previous migration's backfill:
-- zero applications rows are left with a null stage_id. Enforcing
-- NOT NULL now, as a real guard against a future code path that
-- forgets to set it on insert, rather than a silent gap discovered
-- later.
alter table applications alter column stage_id set not null;
