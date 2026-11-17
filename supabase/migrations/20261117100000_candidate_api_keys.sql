-- Candidate personal access tokens, for the new candidate MCP server
-- (apply/favorite/search via MCP, outside the browser session) — the
-- candidate-side mirror of `company_api_keys`. Deliberately free, no
-- billing/entitlement flag anywhere on this table: candidate-side
-- features stay free per this project's own standing economics
-- ("no paid features on the candidate side"), unlike the company key's
-- Top-Employer gate.
--
-- Same posture as company_api_keys: the secret is never stored, only
-- its sha256 hash, and key_hash has no select grant at all — only the
-- admin-client auth check (no cookie session exists for that request)
-- ever reads it.

create table candidate_api_keys (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  key_prefix   text not null,
  key_hash     text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index candidate_api_keys_candidate_idx on candidate_api_keys (candidate_id);

alter table candidate_api_keys enable row level security;

grant select (id, candidate_id, key_prefix, created_at, last_used_at, revoked_at)
  on candidate_api_keys to authenticated;
grant insert (candidate_id, key_prefix, key_hash) on candidate_api_keys to authenticated;
-- Update is revoke-only — a candidate can set revoked_at, never touch
-- the hash/prefix/candidate of an existing row.
grant update (revoked_at) on candidate_api_keys to authenticated;
grant all on candidate_api_keys to service_role;

create policy "candidates manage their own api keys"
  on candidate_api_keys for all to authenticated
  using (candidate_id = public.my_candidate_id())
  with check (candidate_id = public.my_candidate_id());
