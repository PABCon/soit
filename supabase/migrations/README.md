# Migrations

Applied in filename order. `../seed.sql` seeds the `tech_tags` vocabulary and is
idempotent.

| File | Spec |
|---|---|
| `20260921120000_schema.sql` | §5 — tables, enums, constraints, indexes, triggers |
| `20260921120100_rls.sql` | §6 — helper functions, grants, RLS policies, `live_jobs` view |
| `20260921120200_storage.sql` | §6.3 — private `cvs` bucket, public `branding` bucket |
| `20260922090000_verification_backoff.sql` | §5.7.3 — retry bookkeeping columns on `companies`, step 3 |
| `20260922100000_service_role_grants.sql` | Fixes a step-2 gap — `service_role` never had table privileges, only RLS bypass (see below) |
| `20260922110000_applications_apply_policy.sql` | §6.7 (revised v1.10) — apply requires an account; the INSERT policy this makes possible, step 6/7 |
| `20260922120000_candidates_see_applied_jobs.sql` | A candidate can always see a job they applied to, even once it's no longer live, step 6/7 |
| `20260922121000_fix_jobs_applications_rls_recursion.sql` | Fixes 42P17 infinite recursion the policy above caused (see below) |

## ✅ Verified against the live database (2026-09-21)

Applied to the linked project (`bzwavosbvarvdhsogxqt`, "SO IT", eu-central-1)
via `supabase db push`; `seed.sql` loaded (159 `tech_tags`). This machine still
has no Docker/local Postgres, so verification ran against the remote project
directly, not `supabase start`.

All six tests §14 calls for passed, using two employer users, two companies,
a candidate and a mix of live/draft/expired jobs, with `set role` +
`request.jwt.claims` to simulate `anon`/`authenticated` sessions:

- ✅ employer A cannot `select` employer B's `applications`
- ✅ employer A cannot `update` a job belonging to employer B
- ✅ `anon` cannot read `companies.nif` or any `verification_*` column (42501)
- ✅ `anon` cannot read a `draft`, `inactive` or expired job
- ✅ a candidate cannot `update` `applications.status`
- ✅ `anon` and `authenticated` cannot read or write the `cvs` bucket

Test fixtures were cleaned up afterward — the live schema now holds only the
seeded `tech_tags` vocabulary.

To re-verify after a future migration:

```bash
supabase link --project-ref bzwavosbvarvdhsogxqt   # already linked from .env.local
supabase db push
supabase db query --linked -f supabase/seed.sql
```

## ⚠ service_role had no table privileges until step 3 (found 2026-09-22)

`service_role` bypasses RLS via its role attribute, but that's a separate
layer from the ordinary Postgres GRANT system underneath it — and this
project's `public` schema default privileges only auto-grant `anon`/
`authenticated` on new tables (which is why the RLS migration explicitly
revokes them), never `service_role`. Every table created in the schema
migration therefore had zero `service_role` privileges beyond TRUNCATE/
REFERENCES/TRIGGER until `20260922100000_service_role_grants.sql` — meaning
every privileged server-side write (registration, applications, anything
using the admin client) would have failed with 42501 the moment it was
tried, regardless of RLS. Caught while building step 3 and testing the
admin client directly against the live project; fixed by that migration.
If a future migration adds a table, grant `service_role` explicitly — don't
assume it inherits access the way `storage`/`auth` schema tables do.

## ⚠ RLS policies that subquery each other's table can recurse (found 2026-09-22)

`jobs`' "candidates see jobs they applied to" policy subqueried
`applications`; `applications`' pre-existing "employers see applications to
their company's jobs" policy subqueries `jobs` right back. A correlated
subquery inside a `using` clause still goes through the target table's own
RLS — it doesn't get to skip it just because it's inside another table's
policy — so evaluating either one re-entered the other: `42P17 infinite
recursion detected in policy for relation "jobs"`. Caught immediately by
testing the new policy directly (`set role authenticated` +
`request.jwt.claims`) before ever reaching the app. Fixed exactly the way
`my_company_id()`/`my_candidate_id()` already solve this same class of
problem: wrap the cross-table check in a `SECURITY DEFINER` function
(`candidate_applied_to_job()`), which runs with the function owner's
privileges and so doesn't re-trigger the other table's RLS. **Any new
policy whose condition reads from a table that itself has a policy reading
back — write it as a SECURITY DEFINER function, not a bare correlated
subquery.**

## Things to check on first apply

- `citext` and `pgcrypto`: Supabase usually pre-installs these in the
  `extensions` schema; the `create extension if not exists` calls are no-ops if so.
- `create view … with (security_invoker = true)` needs Postgres 15+.
- `my_company()` returns a composite `companies` row; if the platform's
  Postgres rejects `select c.*` for a composite return, use `select c`.
