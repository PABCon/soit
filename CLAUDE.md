# SóIT — working notes

Transparency-first IT job board for Portugal. **`docs/mvp-build-spec.md` is the
source of truth** — read the relevant section before changing behaviour, and
update it *first* when adding a feature (§12.5).

## The two rules that define the product (§1)
1. Every listing shows a salary range. Posting without one is blocked.
2. Every employer is a verified business entity (NIF, §5.7).

## Conventions
- **Brand is `SóIT`; every machine-readable identifier is ASCII `soit`** (§1) —
  npm forbids accented package names and an IDN punycodes to `xn--sit-zma.pt`.
- **Bilingual PT + EN, both locale-prefixed** (`/pt/…`, `/en/…`, §2.2). Every
  string goes through `next-intl` — never hard-code UI text. Run
  `npm run check:i18n` before committing; it fails on catalogue drift.
- Import `Link`, `redirect`, `usePathname`, `useRouter` from `@/i18n/navigation`,
  never from `next/link` or `next/navigation` — they must be locale-aware.
- **Salary is never rendered ad hoc.** Use `@/components/Salary`, which always
  shows amount + period + months + gross + employment type (§5.2).
- Two surfaces, one database (§2.1): route groups `(candidate)` (public, SEO
  critical) and `(console)` at `/recruit` (behind login, `noindex`).
- **RLS is the security model** (§6). Never filter by tenant in client code.
  Privileged cross-tenant writes use the service role key, server-side only.
- **Never mark a `NEXT_PUBLIC_*` Vercel env var "Sensitive."** Sensitive vars
  are withheld from the build step, but `NEXT_PUBLIC_*` values are inlined
  into the bundle *at build time* — marking one Sensitive silently bakes in
  `undefined` and it reads fine locally (`.env.local` isn't subject to this)
  right up until it 500s every route in production. `NEXT_PUBLIC_` already
  means "goes to the browser," so Sensitive adds no real confidentiality
  here anyway. `vercel env add <name> <env> --type config --force` fixes an
  existing one. `SUPABASE_SERVICE_ROLE_KEY` is the opposite case — genuinely
  server-only — and should stay Secret.

## Commands
- `npm run dev` · `npm run build`
- `npm run check` — i18n parity + lint + typecheck
- `npm run test` — vitest (currently just the NIF validator, §14 testing floor)

## Build sequence
§14 of the spec. **Step 1 (skeleton + i18n + shells + tokens) is done.**
**Step 2 (schema, RLS, storage buckets) is done and verified** against the
live Supabase project ("SO IT", ref `bzwavosbvarvdhsogxqt`) — see
`supabase/migrations/README.md`. `.env.local` holds real project credentials.

**Step 3 (auth + employer verification) is done**: email/password + social
(Google/GitHub/LinkedIn — wired, inert until OAuth credentials are added in
the Supabase dashboard) registration and login for both roles, NIF layer-1
validation (`src/lib/nif.ts`, exhaustively tested), async VIES verification
with lazy retry (no cron — Vercel Hobby's minimum interval is daily), and
role-split landing (§6.4). See `src/lib/auth/complete-registration.ts` for
the profile-creation/claiming logic and `docs/mvp-build-spec.md` §5.7/§6.4/§9
for the rules it implements. Verified directly against the live database
(admin client, both role branches, idempotency, a real VIES round trip) —
see git history for the verification transcript.

Two production incidents surfaced and fixed while shipping this step, both
worth reading `supabase/migrations/README.md` and this file's Conventions
section for: `service_role` had no table privileges at all (RLS bypass and
the GRANT system are separate layers), and `NEXT_PUBLIC_SUPABASE_URL`/
`ANON_KEY` were marked Sensitive in Vercel, which took the whole site down
the moment step 3 added the first server-side code path that actually
constructed a Supabase client in production (candidate pages before this
read a static fixture, never touching Supabase at all).

Known gaps, not blockers: production's `https://soit.vercel.app` isn't yet
in the Supabase Auth redirect allowlist (only `soit-soit.vercel.app`
patterns are — add it in the dashboard before relying on employer/candidate
registration in production); Supabase's default email sender is
rate-limited enough to make repeated local testing slow.

Next: step 4 — employer console (My job ads, Add job advertisement, Company
Profile editor, publish gated on `verification_status = 'verified'`).
