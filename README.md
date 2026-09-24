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
  app/[locale]/(candidate)/jobs/in/  Browse pages — /jobs/in/[location]/[facet] (justjoin.it-style)
  lib/db/locations.ts, job-categories.ts  Curated pickers replacing free-text location on JobForm
  app/sitemap.ts, robots.ts  New — every live job/company page + non-empty browse combinations only
  lib/auth/complete-registration.ts  ensureEmployerProfile/ensureCandidateProfile — same-email dual-role (§6.4a)
  app/api/auth/attach-role/  Attaches a second role to an already-logged-in account
  components/EngagementPopup.tsx  Growth nudge after 3 distinct job views, signed-out only
  components/Modal.tsx  Shared modal wrapper, extracted from ApplyModal.tsx
  lib/db/tech-tags.ts  getFeaturedTechCounts() — a curated 20-tag subset for Language/Technology browse
  app/[locale]/(preview)/companies/[slug]/preview/  Noindex company-page twin, no site nav — opened from the console
  components/candidate/CompanyProfileBody.tsx  Shared company-page content, reused by the public page and the preview route
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
fixed; see `CLAUDE.md` for the full writeup. Job browse pages
(`/jobs/in/[location]/[facet]`, justjoin.it-style) came next and grew
mid-plan into a data-hygiene pass: job **category** — distinct from tech
tags — didn't exist anywhere, so a curated `job_categories` taxonomy
joined a new `locations` taxonomy, both replacing what used to be a
free-text location field on the posting form with required pickers. A new
`sitemap.ts`/`robots.ts` list every live job/company page plus only the
browse-page combinations that actually have jobs — see `CLAUDE.md` for the
routing-collision design (`/jobs/[slug]` already owns job detail) and two
real bugs the pass surfaced. Same-email dual-role (§6.4a) came next: one
login can now hold both a candidate and an employer profile — Supabase
Auth won't allow two separate accounts sharing an email, so
`completeRegistration` was split into idempotent per-role functions
(`ensureEmployerProfile`/`ensureCandidateProfile`), a new `/api/auth/
attach-role` attaches the second role to an already-logged-in session
behind an explicit confirm screen, and a real pre-existing bug (team
invite acceptance via "login" mode never actually created the
`employer_users` row) got fixed as a side effect of reusing the same
mechanism — see `CLAUDE.md`. A browsing-engagement popup followed: a
signed-out visitor who's viewed 3 distinct jobs (tracked client-side,
`localStorage`, no new table) gets a one-time nudge to create an
account — corrected from the original "abandoned application" framing to
a browsing-behavior one during triage. Two more curated browse facets
came next — Language and Technology, a small featured 20-tag subset of
the existing `tech_tags` vocabulary (not a new taxonomy), reusing the
same `/jobs/in/[location]/[facet]` route already built; a third, unrelated
thing surfaced in the same request — the job's own ad language (PT/EN)
wasn't filterable at all — added as a plain chip filter, not a browse
route (only 2 values) — see `CLAUDE.md`. A real bug report ("employer
login just doesn't load") turned out to be two things: real latency
(`/api/auth/landing` did an unnecessary blocking third Supabase round
trip for non-critical bookkeeping, now backgrounded via `after()`) and,
the bigger factor, zero loading feedback on the login/register buttons
during the wait — both fixed, see `CLAUDE.md`. A follow-up report on
the same flow ("shows loading, then doesn't move") turned out not to be
the dual-role account the reporter suspected (checked and ruled out) but
a second layer of the same bug: the loading state was reset as soon as
the request resolved, before the separate, untracked `router.push()`
navigation had actually finished — now the loading UI stays visible
honestly through the whole handoff; see `CLAUDE.md`. The same report
also questioned why an employer session has any path into the main
candidate site — the console's "Ver perfil público" opened the public
company page in a new tab, but that tab carried the full candidate nav
(search, login menu, Jobs/Applications/etc.), a real way to wander into
the main site from a one-off preview; it now opens a noindex `/preview`
twin with no site nav at all, sharing content with the public page via
a new `CompanyProfileBody` component. A second claim in the same
report — 2 applications visible under the employer account — couldn't
be corroborated at first and was left open; a follow-up screenshot
proved it real and worse than suspected: `applications` has two
permissive RLS policies (candidates see their own; employers see
applicants to their own jobs), and `getMyApplications()` ran a fully
unfiltered query relying on RLS alone — an employer session got the
union of both, showing their own job's real applicants mislabeled as
"my applications." Fixed with an explicit `candidate_id` filter instead
of trusting RLS to pick the narrower policy on its own. Per explicit
follow-up instruction ("logged in as a company should never reach the
main jobs page"), the candidate route group's layout now redirects any
employer-only session straight to `/recruit`, covering every entry
point at once — see `CLAUDE.md` for the full writeup, including a
red-herring dev-cache 500 that looked alarming but wasn't real.
Per the spec, steps 1-7 being done means there's a working two-sided
marketplace, loop closed, end to end. Next: step 9 — SEO check,
compliance, and polish — plus the rest of the real-usage QA backlog (see
`CLAUDE.md`).
