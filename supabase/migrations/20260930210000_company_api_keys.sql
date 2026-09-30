-- Top Employer API access (billing phase 4) — "API access for
-- programmatic job posting", sold on the pricing page since phase 2,
-- built for real here.
--
-- The secret itself is never stored — only its sha256 hash. The API's
-- own auth check (an admin-client lookup, no cookie session exists for
-- that request at all) is the only thing that ever reads key_hash;
-- same posture as companies.nif/verification_* — reachable only
-- through code that explicitly bypasses RLS, never through a grant.

create table company_api_keys (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  key_prefix   text not null,
  key_hash     text not null unique,
  created_by   uuid references employer_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index company_api_keys_company_idx on company_api_keys (company_id);

alter table company_api_keys enable row level security;

grant select (id, company_id, key_prefix, created_at, last_used_at, revoked_at)
  on company_api_keys to authenticated;
grant insert (company_id, key_prefix, key_hash, created_by) on company_api_keys to authenticated;
-- Update is revoke-only — an owner can set revoked_at, never touch the
-- hash/prefix/company of an existing row.
grant update (revoked_at) on company_api_keys to authenticated;
grant all on company_api_keys to service_role;

create policy "owners manage their own api keys"
  on company_api_keys for all to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner')
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
