# Migrations

Applied in filename order. `../seed.sql` seeds the `tech_tags` vocabulary and is
idempotent.

| File | Spec |
|---|---|
| `20260921120000_schema.sql` | §5 — tables, enums, constraints, indexes, triggers |
| `20260921120100_rls.sql` | §6 — helper functions, grants, RLS policies, `live_jobs` view |
| `20260921120200_storage.sql` | §6.3 — private `cvs` bucket, public `branding` bucket |

## ⚠ Not yet verified against a database

These were written from the spec but **never executed** — this machine has
neither Docker (so `supabase start` cannot run) nor a local Postgres. Nothing
should depend on the RLS policies until they have been applied and tested.

To verify:

```bash
supabase link --project-ref <ref>
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

Then the tests §14 calls for, which are the ones that actually matter:

- employer A cannot `select` employer B's `applications`
- employer A cannot `update` a job belonging to employer B
- `anon` cannot read `companies.nif` or any `verification_*` column
- `anon` cannot read a `draft`, `inactive` or expired job
- a candidate cannot `update` `applications.status`
- `anon` and `authenticated` cannot read or write the `cvs` bucket

## Things to check on first apply

- `citext` and `pgcrypto`: Supabase usually pre-installs these in the
  `extensions` schema; the `create extension if not exists` calls are no-ops if so.
- `create view … with (security_invoker = true)` needs Postgres 15+.
- `my_company()` returns a composite `companies` row; if the platform's
  Postgres rejects `select c.*` for a composite return, use `select c`.
