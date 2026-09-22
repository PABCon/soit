# Migrations

Applied in filename order. `../seed.sql` seeds the `tech_tags` vocabulary and is
idempotent.

| File | Spec |
|---|---|
| `20260921120000_schema.sql` | §5 — tables, enums, constraints, indexes, triggers |
| `20260921120100_rls.sql` | §6 — helper functions, grants, RLS policies, `live_jobs` view |
| `20260921120200_storage.sql` | §6.3 — private `cvs` bucket, public `branding` bucket |

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

## Things to check on first apply

- `citext` and `pgcrypto`: Supabase usually pre-installs these in the
  `extensions` schema; the `create extension if not exists` calls are no-ops if so.
- `create view … with (security_invoker = true)` needs Postgres 15+.
- `my_company()` returns a composite `companies` row; if the platform's
  Postgres rejects `select c.*` for a composite return, use `select c`.
