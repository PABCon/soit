-- Matchmaking real-usage report, item 2: an employer had no way to tell
-- which matches on a job they'd already opened vs genuinely new ones, and
-- opening a match never marked it as seen. `status` already exists but is
-- a deliberately separate pipeline concept (shortlisted/contacted/passed)
-- an employer sets by hand — "have I actually looked at this card yet" is
-- a distinct, narrower fact that should flip automatically on first view,
-- not something tangled into the status an employer explicitly chooses.
alter table candidate_match_notes
  add column viewed_at timestamptz;
