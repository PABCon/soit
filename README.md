# SóIT

A transparency-first IT job board for the Portuguese market. *Só* is Portuguese
for *only*: only IT, and only real salaries.

**Two rules define the product:**

1. **Every listing shows a salary range** — amount, period, and employment type.
   Posting without one is blocked. "2000–3000" is ambiguous in a market that
   quotes monthly gross over 14 months, so the salary is never rendered
   without its unit.
2. **Every employer is a verified business entity**, validated by NIF.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · TypeScript · Supabase
(Postgres + Auth + Storage) · `next-intl` · Vercel.

The candidate surface is server-rendered and individually crawlable — discovery
leans on organic search and Google for Jobs, and a client-rendered SPA fails to
get indexed, killing that channel silently.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

Then open http://localhost:3000 — it redirects to `/pt` or `/en` based on your
`Accept-Language`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run check` | Message-catalogue parity + lint + typecheck |
| `npm run check:i18n` | Fails if the PT and EN catalogues have drifted |
| `npm run test` | Vitest — the NIF validator's table-driven tests |

## Layout

```
docs/                     The spec. Source of truth — read it first.
  mvp-build-spec.md       Architecture, data model, security, build sequence
  flows/*.mmd             Mermaid flows, importable into Miro
messages/{pt,en}.json     UI strings. Both locales, always in sync.
src/
  i18n/                   Locale routing, request config, navigation helpers
  proxy.ts                Locale negotiation (Next 16's middleware convention)
  app/[locale]/
    (candidate)/          Public job site — SEO critical
    (console)/recruit/    Employer console — behind login, noindex
  components/Salary.tsx   The one salary component. Never render one ad hoc.
  app/[locale]/(auth)/    Candidate/employer login + register (§9.2)
  app/auth/callback/      OAuth + email-link confirmation — outside [locale]
  lib/supabase/           Browser, server and admin (service-role) clients
  lib/nif.ts              NIF layer-1 validation (§5.7.2), exhaustively tested
  lib/verification/       Async NIF registry lookup — ViesProvider (§5.7.6)
  lib/auth/               Profile creation/claiming + login landing (§6.4, §6.5)
  lib/db/                 Server-only, RLS-scoped data layer: jobs, companies, team
  app/[locale]/(candidate)/companies/  Companies listing + public company page (§7.1)
  app/[locale]/(console)/recruit/  My job ads, job form, company profile, team
  app/[locale]/(candidate)/applications/  Candidate's own applications (§7.1)
  app/[locale]/(console)/recruit/jobs/[id]/applicants/  Employer Applicants view (§7.2)
  lib/db/applications.ts  Apply, CV upload, status updates — §6.7 (v1.11: account-free again)
  lib/file-sniff.ts       Content-sniffs uploaded CVs by magic bytes, never by extension
  components/ApplyModal.tsx  Apply modal — account-free, external-URL bypass (§7.1, v1.11)
  lib/email/               EmailProvider interface + templates, built but not connected (§9.1a)
  app/[locale]/(candidate)/profile/  Candidate profile — name/CV/avatar/skills
  app/[locale]/(candidate)/settings/  Candidate password change
  app/[locale]/(console)/recruit/settings/  Employer's own profile + password change
  app/[locale]/(auth)/forgot-password/, reset-password/  Password recovery
  lib/db/candidate-profile.ts  Self-profile reads/writes + master CV, distinct from per-application CVs
```

## Conventions

- **Bilingual PT + EN**, both locale-prefixed. Every string goes through
  `next-intl`; `npm run check:i18n` fails on catalogue drift.
- Import `Link` / `redirect` / `usePathname` / `useRouter` from
  `@/i18n/navigation`, never from `next/*` — they must be locale-aware.
- The brand is **SóIT**; every machine-readable identifier is ASCII **`soit`**.
- **RLS is the security model.** Never filter by tenant in client code.

## Status

Build sequence is §14 of the spec. **Step 1 complete** (skeleton, i18n, both
shells, design tokens). **Step 2 complete** (schema, RLS, storage buckets) —
migrations are applied and verified against the live Supabase project; see
`supabase/migrations/README.md`. **Step 3 complete** (auth + employer
verification) — email/password + social login (Google/GitHub/LinkedIn,
inert until OAuth credentials are added in the Supabase dashboard),
NIF layer-1 + async VIES verification, role-split landing. See `CLAUDE.md`
for the known gaps (production redirect-URL allowlist, email rate limits).
**Step 4 complete** (employer console) — and the candidate surface now
reads the real database (steps 5/8 done early; see `CLAUDE.md`), plus a new
public company page and Team/invite. **Steps 6/7 complete** (apply +
Applicants), then reversed by real-usage QA: applying is **account-free
again** (v1.11, reverses v1.10) via a modal, an unclaimed profile is
created and claiming is offered after applying — see `CLAUDE.md`. Same
pass added an optional per-job external apply URL (bypasses the internal
flow entirely) and built the full application-email flow (real templates,
real trigger points) behind a swappable `EmailProvider`, not yet connected
to a real sender (§9.1a). A `/companies` listing page and a richer public
company profile (banner + circular logo, social links, a stat-card row)
followed, modelled on a rocketjobs.com reference — see `CLAUDE.md` for what
was scoped out (Follow, AI-generated profiles, theme picker) and a real
RLS column-grant bug it surfaced. Six quick bug fixes came next: job
delete (drafts only — applications block deletion at the DB level) and
pause/reactivate, the applicant count now actually links to Applicants,
a real "account already exists" error on dual-role signup instead of a
silent dead end, and image-upload errors surface instead of failing
silently — including a real Next.js Server Actions body-size-limit bug
that fix uncovered (see `CLAUDE.md`). Account basics followed: a candidate
profile page (`/profile`, name/phone/LinkedIn/skills/avatar/master CV), a
shared password-change form, a real forgot-password flow (with a branch
in `/auth/callback` for recovery links), and team members now have a name
+ picture (stored in `auth.users.user_metadata`, not a new column). That
pass surfaced a real, pre-existing bug — `getMyEmployerContext()` broke
the entire `/recruit` console for any company with a second team member —
fixed; see `CLAUDE.md` for the full writeup.
Per the spec, steps 1-7 being done means there's a working two-sided
marketplace, loop closed, end to end. Next: step 9 — SEO check,
compliance, and polish — plus the rest of the real-usage QA backlog (see
`CLAUDE.md`).
