-- Matchmaking rework, Phase 3: a real accept/decline gate for employer
-- outreach to a blinded match. Today, sending the first message IS the
-- only "ask," and a candidate's first reply silently both continues the
-- conversation AND unlocks identity. The real mechanic (and the user's
-- own explicit choice when this phase was scoped) is a genuine request
-- the candidate must accept or decline before any back-and-forth opens
-- at all. `origin = 'application'` threads are unaffected — identity
-- there is already known from the application itself, so they start
-- (and stay) 'accepted', no gate.

alter table message_threads
  add column request_status text not null default 'accepted'
    check (request_status in ('pending', 'accepted', 'declined')),
  add column responded_at timestamptz;

-- Backfill existing match-origin threads: one that already unlocked
-- (the candidate already replied, under the old implicit mechanic) is
-- treated as already-accepted — no reason to retroactively gate a
-- conversation that's already open. One that never unlocked goes
-- 'pending' — the candidate now sees it as a real request needing a
-- response, a stricter (not looser) rule than before, so nothing
-- previously visible becomes invisible.
update message_threads
set request_status = case when identity_unlocked then 'accepted' else 'pending' end
where origin = 'match';

-- No new column grant for authenticated: same "server-computed state"
-- posture already established for identity_unlocked/last_message_at —
-- both flip only via respondToConnectionRequest()/sendMessage()'s admin
-- client, never a direct client update.
