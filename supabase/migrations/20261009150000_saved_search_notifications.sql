-- Real-usage QA item: "save search" only ever meant "come back to this
-- later" — no notify-me ever existed (deliberately cut from scope at
-- 20260927224500_saved_searches.sql, no email sender or scheduled-job
-- infra existed yet; both now do). Saving a search now IS opting into
-- notifications — one button, no separate confusing checkbox in the
-- already-cramped nav search bar — with a per-row toggle on the
-- /saved-searches management page for anyone who wants to turn it back
-- off without deleting the search.
--
-- Default true: an existing saved search predates this feature and its
-- owner never got a chance to say no, but the whole point of the
-- feature this row represents was "notify me" from the user's
-- perspective even before the column existed — true is truer to intent
-- than silently opting everyone out.
alter table saved_searches
  add column notify_opt_in boolean not null default true,
  add column last_notified_at timestamptz;

-- Candidate-editable like every other column on this table (the existing
-- grant is table-wide, not column-restricted) — no grant change needed.
-- last_notified_at is written only by the cron job via the admin client
-- (service_role already has `grant all` from this table's own migration).
