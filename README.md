# Just IT

A transparency-first IT job board for the Portuguese market: just IT jobs,
always with a real salary shown. (Renamed from **SóIT** on 2026-09-28 — that
name's pun only landed for Portuguese readers, a real problem for a site
that's explicitly bilingual. See `CLAUDE.md` for the full rename writeup,
including what was deliberately *not* renamed.)

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
  components/Footer.tsx  Page links + LinkedIn (env-gated) + legal links, in (candidate)/(auth), not (preview)
  app/[locale]/(legal)/  Minimal shell for /privacy, /terms — placeholder content, real copy is separate backlog
  lib/db/favorites.ts  toggleFavorite/getMyFavoriteJobIds/getMyFavoriteJobs — mirrors applications.ts's shape
  app/[locale]/(candidate)/favorites/  Saved jobs — same shell as applications, full JobRow card
  components/JobsExplorer.tsx  Merged /jobs split list+map view — curated filters, sort, URL-synced (not next/navigation's router — see CLAUDE.md)
  hooks/useUrlSearchParams.ts  Shared instant URL read/write (History API), used by JobsExplorer and the nav SearchBar
  components/nav/SearchBar.tsx  Real search (title keyword + near/radiusKm) — centered in TopNav
  lib/db/saved-searches.ts, app/[locale]/(candidate)/saved-searches/  Save/list/delete a search — no email delivery yet
```

## Conventions

- **Bilingual PT + EN**, both locale-prefixed. Every string goes through
  `next-intl`; `npm run check:i18n` fails on catalogue drift.
- Import `Link` / `redirect` / `usePathname` / `useRouter` from
  `@/i18n/navigation`, never from `next/*` — they must be locale-aware.
- The brand is **Just IT**; every pre-existing machine-readable identifier
  stayed **`soit`** (npm package, repo/directory, localStorage keys, custom
  event names) — deliberately not renamed alongside the brand, see
  `CLAUDE.md`.
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
A third round of real-usage QA landed as 14 notes at once — nav, the
whole landing page, search, favorites, job posting — planned into 5
shippable phases (see `CLAUDE.md`). **Phase 1 (nav/chrome) shipped**:
`LoginMenu`'s signed-in state is now a real avatar + nav menu instead of
plain email text (and doubles as the only nav on mobile, since `Rail` is
hidden below `sm`); "Add offer" no longer shows to a logged-in candidate;
`Rail` is now collapsible (a real bug caught along the way — the first
cut read `localStorage` inside a `useEffect` and `setState`-ed it, which
`react-hooks/set-state-in-effect` correctly flagged before it ever ran;
fixed with `useSyncExternalStore`); a real footer exists for the first
time (page links + an env-gated LinkedIn icon + legal links), alongside
new placeholder `/privacy`/`/terms` pages; a nav tagline sits under the
wordmark; the language switcher is a compact dropdown instead of both
locales always visible. **Phase 2 shipped**: job expiry is no longer
purely automatic — an optional employer-set "valid until" date on the
job form (still defaults to 1 month when left blank, matching the prior
hardcoded behavior), plus a "days left" urgency badge on the feed and
job detail page once a listing is within a week of expiring. A real
production-only bug was caught and fixed during this phase's own
verification, before the user saw it: the new footer's plain link to
`/recruit` on the login page collided with Next's automatic prefetching
and the post-login redirect's Router Cache entry, leaving login stuck
on "A entrar…" forever on production only (never locally) — fixed with
`prefetch={false}` on every footer link; see `CLAUDE.md` for the full
trace. **Phase 3 shipped**: candidates can now save a job to review
later — a heart toggle on every job card (new `favorites` table, RLS
scoped the same way as everything candidate-owned) and a new
`/favorites` page. A saved job stays visible there even after it's no
longer live, mirroring how `/applications` already keeps a candidate's
own application history around past a job's expiry. An out-of-order
design ask followed: the left rail restyled to match a reference
(justjoin.it-style) collapse pattern — collapsing removes it from
layout entirely, replaced by a small floating vertical tab, rather than
shrinking to a thin strip, with a soft highlight behind the current
section. **Phase 4 shipped**: the big one — `/jobs` and `/map` merge
into one split list+map view, filter state moves from local component
state to the URL (the fix for "map disappears when filtering" — both
panes now read the same filtered set), a curated one-row tech/category
filter with a "more filters" panel for the rest, sort + a remote-only
toggle, and a result count above the list. A second real
production-only bug was caught and fixed during this phase's own
verification — every filter click was firing a real ~650ms server
round trip that should've been instant client-side filtering; fixed by
reading/writing the URL directly via the History API instead of
`next/navigation`'s router, confirmed instant (zero network requests)
on both localhost and production afterward. **Phase 5 shipped — the
last phase of this QA round**: a real search bar (title keyword + "near
a curated city within N km," no geocoding provider needed — every
curated location already has fixed coordinates and every job's own
lat/lng is already fetched, so it's just another client-side filter),
centered in the nav, plus save-this-search (list/delete only, no email
delivery yet — no real sender or scheduled-job infra exists in this
project). Two more real production-only bugs were caught and fixed
during this phase's own verification, the second and third of this same
kind this round (after phase 2's footer-prefetch login hang and phase
4's filter round trip): the exact same round-trip class of bug in the
save-search error path, and a genuine Leaflet crash from recreating the
whole map instance on every filter change — fixed by creating the map
once and only redrawing its markers on change; both confirmed against
production afterward. This closes all 14 items from the original
real-usage QA round, plus a mid-batch rail restyle. Per the spec,
steps 1-7 being done means there's a working two-sided marketplace,
loop closed, end to end. **Renamed to Just IT** (was SóIT) — the old
name's pun only landed for Portuguese readers, a real problem for an
explicitly bilingual site; the new name reads directly in both
languages and matches the domain being bought, `justit.pt` (see
`CLAUDE.md` for the full writeup, including what was deliberately left
as `soit` internally). **An 8-item real-usage UX pass** shipped next:
Rail is now a purely floating trigger + ephemeral popover (never a
layout-affecting sidebar, freeing the page width for a `max-w-[1600px]`
content container), dropdowns dismiss on an outside click via a new
shared `Dropdown` component, the map gained a cross close button plus a
right-edge reopen tab mirroring Rail's own, the curated filter row is
now non-scrolling circular icon chips (real logos via a one-time
`simple-icons` extraction, generic `lucide-react` glyphs for
categories), sort/remote-toggle/count share one row with "more filters"
now a left-side panel that auto-hides the map, a favorite button was
added to the job detail page, the redundant `/jobs` tagline was
removed, and save-search got a visible label and clearer hint. A real
bug (an invalid `z-500` Tailwind class silently left the map's close
button unclickable under Leaflet's own zoom control) was caught and
fixed by the batch's own verification before shipping — see `CLAUDE.md`
for the full writeup. **An 11-item employer-console review** is now
underway as a 7-phase plan (nav, applicants, team invites, account,
company map, job-requirements/languages, and an LLM-based job-link
autofill — full plan at `~/.claude/plans/refactored-zooming-wren.md`);
pricing and a direct-contact channel are explicitly deferred pending a
business-model discussion, not built as part of it. **Phase 1
shipped**: a top navbar for the employer console (avatar dropdown +
language switcher, mirroring the candidate site's own `TopNav`) and a
back link on the per-job Applicants page. **Phase 2 shipped**: Team
invites now show an expiry readout and support Revoke/Resend — the
`employer_invites` RLS policy already covered this, only the app-code
actions and UI were missing. **Phase 3 shipped**: the employer's own
account page gained a phone field and a read-only display of their
login email. **Phase 4 shipped**: an aggregated `/recruit/applicants`
tab across every job, and a canonical candidate detail page
(`/recruit/applicants/[id]`) that auto-marks an application "viewed" —
without ever downgrading a status the employer already moved further
along. **Phase 5 shipped**: companies can now set a curated-city
location + street address, shown as a map + address line on the public
profile page (a real Leaflet default-marker-icon 404 bug was caught and
fixed by this phase's own verification). **Phase 6 shipped**: employers
can mark tech tags as must-have with a proficiency level and set
required working languages (both feed the future candidate-scoring
engine, not scoring itself), the job detail page shows required
languages, and a new expiry progress bar matches the reference
screenshot. **Phase 7 shipped — closing the
employer-console review**: paste a link to an existing job posting and
auto-fill the create-job form, this project's first-ever LLM
integration — Vercel AI Gateway, model Claude, verified with a genuine
real end-to-end extraction run (not mocked) on both localhost and
production. Item 6 (pricing) stays explicitly deferred. A real-usage report on
session length led to a new **go-live checklist**
(`docs/go-live-checklist.md`) consolidating every "before launch" item
across this project — checked against the live Supabase/Vercel state,
not assumed. **Item 7's email half shipped**: an employer-only
`/recruit/contact` page (confirmed explicitly — not a general/
candidate channel — genuinely gated via the console's own auth guard,
reachable from the console sidebar); the chat half was deliberately
skipped for now (build-vs-buy discussed — a third-party widget stays
the right call whenever it's revisited, not building one from
scratch). **A third instance of the recurring footer-prefetch login-hang
bug** was found (candidate logout → employer login hanging forever) and
fixed the same way the first two were — `prefetch={false}` on the one
remaining unguarded link — reproduced 6/6 on production before the fix,
0/6 after, via a real UI-driven repro (see `CLAUDE.md` for two real
testing-methodology traps hit while chasing it down).

**AI Pieces backlog, phase 1 shipped**: candidates can now upload a CV
(PDF/DOCX) and have it parsed by an LLM into a structured, fully-editable
profile — skills and working languages (matched against the exact curated
vocabulary the job side already uses, so a future matching engine can
compare like-for-like), education, headline, years of experience. This
collapses two originally-separate asks (a LinkedIn-fetch onboarding popup,
and CV upload) into one feature, since LinkedIn has no legit fetch-by-URL
API — the real pattern is LinkedIn's own "Save to PDF" export fed through
the same parser as any other CV. Also settled: candidate side stays
entirely free, all paid features (starting with a future matching/scoring
engine) live on the employer side. A new first-login prompt nudges a
CV-less candidate once, dismissible. Verified end-to-end on both localhost
and production with a real generated PDF, not a mocked response. Deferred,
not built yet: the matching engine and job recommendations themselves
(item 3/4 — this phase only creates the data they'll need), CV export, and
photo extraction. See `CLAUDE.md` for the full writeup, including a related
finding (LinkedIn/Google/GitHub sign-in buttons already exist in the UI but
are functionally inert — captured in the plan file, not yet implemented).

**Vocabulary gap fixed the same day**: running a genuine functional/
commercial CV through the new autofill came back thin — checked the live
database and confirmed `tech_tags`' 159 entries were 100% technical, zero
coverage of sales/recruitment/delivery/marketing despite `job_categories`
already scoping for non-engineering roles. Added ~40 curated functional
skills, plus a new `skill_suggestions` table that logs every unmatched
CV-parse label with an occurrence count — seed data for a future admin
panel's "review pending tags" screen. Verified on both environments,
including confirming repeat unmatched labels increment rather than
duplicate. `docs/go-live-checklist.md` now also recommends building a real
admin panel before launch (there currently isn't one — every admin action
so far has been a one-off script).

**Candidate profile depth shipped the same day**: real-usage feedback
(a genuinely detailed profile run through CV-autofill, plus two more
justjoin.it reference screenshots) surfaced six gaps — no work-history
storage, no certifications, the analyzed CV file was never actually
stored/downloadable, no editing after the fact, and no job-preferences
concept. Fixed all of them: new `candidate_experience`/`candidate_
certifications` tables, job preferences reusing the existing curated
categories/locations, the profile page restructured into four tabs
(Overview/Job Preferences/Experience/Skills & Education) where every
section is independently, persistently editable with its own save — no
longer a one-shot AI-review-only flow — and "Analyze my CV" now actually
leaves a downloadable file behind. Verified live on both environments.

**Closed the loop the same day**: AI extraction now also covers work
experience and certifications, and — the bigger change — "Analyze my CV"
no longer has its own separate review/apply screen. It hands the parsed
draft straight into the same persistent, always-editable tabs a candidate
uses for manual entry, prefilled but unsaved, so reviewing an AI result
and editing by hand are the exact same UI. The first-login popup applies
directly (no tab UI to hand off to on other pages) via the same granular
save actions. A real bug — the CV preview link vanishing again after a
tab switch — was caught by this phase's own live verification and fixed.

**Extraction quality fixed against real data**: inspecting a real
account's stored experience (read-only, never modified) showed
descriptions landing as thin, semicolon-joined summaries instead of the
CV's actual detail, and name/phone/LinkedIn never being extracted at
all. Fixed both — the prompt now explicitly preserves each bullet point
as its own line rather than compressing them, and the draft prefills
contact fields too (only when the CV states them, never overwriting
silently). Verified live on both environments with a real bullet-pointed
CV.

**Job-description formatting fixed too**: for links pasted in ("paste a
job link"), the real bug was that the HTML-stripping step destroyed
paragraph/list structure before the model ever saw the text — fixed at
the source, plus the same "don't compress" prompt discipline. For an
employer's own typed/pasted text, a new "Polish with AI" button
reformats it into clean paragraphs and bullet lists without changing the
content. Also fixed a related rendering bug: the candidate-facing job
page was silently collapsing line breaks in the description even when
they were there — it now renders real `<ul>` lists. Verified live on
both environments with a messy, unpunctuated paste.

**Profile UX polish, same day**: three more real-usage complaints, all
fixed. Every section's explicit "Save changes" button is gone, replaced
by debounced autosave (~800ms after a change, new `useAutosave` hook) —
caught and fixed a real gap where an AI draft's unedited first render
needed to autosave too, or it would silently vanish if never touched.
"Analyze my CV" no longer forces a re-upload when a CV is already on
file — it just re-analyzes what's stored. And work-experience bullet
points are now a real `text[]` column instead of dashes inside a text
blob, rendering as actual bullet rows in the edit UI — and setting up
exactly what a future CV-export feature will need (map the array
straight into real bullets, no parsing). Verified live on both
environments with zero button clicks and zero console errors.

**AI Pieces item 4 shipped**: job recommendations for candidates, framed
explicitly as a growth mechanic per your own request — a "clickbait"-
style highlighted entry at the top of the Rail nav plus a homepage
banner on `/jobs`, both leading to a new public `/recommendations`
route that funnels an anonymous visitor toward registration ("ads
mentality") while showing a real candidate their actual ranked matches.
Scoring is a deliberate lightweight heuristic (skill + preference
overlap) — not the bigger, later, employer-paid matching engine.
Caught and fixed a real issue in verification: unmatched jobs were
inflating the "N jobs match you" count, so a minimum match-score floor
was added before anything counts as a real match. Verified live with a
real fixture on both environments — a correctly-scored 90% match ranked
first, unrelated jobs correctly excluded. Future Rail entries in the
same "clickbait" pattern (salary calculator, career advice, interview
prep, CV review) are explicitly not built yet.

**Match quality follow-up**: live usage caught a real false positive —
a candidate with a business/delivery background (a couple of shallow,
shared tags like Python/SQL) was shown as matched to a "Senior Big Data
Engineer" role. Root cause was generous neutral defaults (half-credit
for jobs with no tagged requirements, plus credit for preference
alignment) stacking up past the old 30% floor with no real skill
evidence behind them. Fixed with three changes together: the floor
raised to 70%, the no-required-tags neutral default cut from 30 to 10
so it can no longer coast a job to a passing score on preferences alone,
and job preferences now enforced as a hard prerequisite (not just an
optional scoring input) — recommendations only show once a candidate
has both skills and preferences set. Verified live with fresh fixtures:
a skills-only candidate now correctly hits a "set your preferences"
prompt instead of a score, and a genuine full match still scores 90%
and displays correctly.

**Employer pricing & billing shipped, phase 1 of 4**: the long-deferred
pricing conversation happened for real this round — grounded in actual
competitor pricing (justjoin.it, LinkedIn, Indeed) and one real data
point (an existing customer's real spend at scale on a competitor board),
reverse-engineered into a volume-discount curve rather than guessed
percentages. Two separate products came out of it: self-serve job-ad
credits (built this phase, real Stripe Checkout, real webhook,
end-to-end verified in Stripe test mode) and a Top Employer subscription
(badge, site-wide placement, rich company profile, API access — scoped,
not built yet). Every verified company still gets 1 free job live,
same as always; publishing more spends a purchased credit. Hiding the
salary publicly is now a paid-tier-only choice — the free tier's salary
stays mandatory and public, unchanged.

**Phase 2 shipped**: real, direct feedback that the pricing page was
"extremely poor" (no discounts highlighted, no perk descriptions, no
free tier shown, no Top Employer at all, a dead-end "contact us") led to
a full redesign — discount badges, perk bullets, a real contact link —
and, alongside it, Top Employer's actual subscription checkout and
webhook lifecycle (real Stripe subscriptions, verified activating and
canceling correctly on both localhost and production, the latter
through the real registered webhook, not a simulation).

**AI Pieces item 3 shipped, phase A**: the big employer-paid matching
engine, deferred all session — built off the real justjoin.it
"Matchmaking Beta" source document. A blinded, scored candidate list per
job ad (match %, skills, experience, salary expectation — never name,
contact, or any identity) at `/recruit/matchmaking`, available to any
paying employer. The scoring math is now provably shared with the
candidate-facing recommendation engine (one formula, two call sites,
can't drift apart). Messaging and identity-unlock-on-reply are a
deliberately separate phase B — not built yet, and not promised as if
they were.

**Matching phase B shipped**: direct messaging, unifying two real needs
into one system — blind matching outreach (identity unlocks only once
the candidate replies) and direct contact with an already-applied
candidate (identity known from the start). New inboxes on both sides
(`/recruit/messages`, `/messages`), unread badges, notification emails.
Verified live with the full two-origin loop: a blinded match stayed
fully anonymous until the candidate's own reply flipped it, an applicant
thread was unlocked from the first message, checked directly against
the raw HTML response for any identity leak.

**Phase 3 shipped**: Top Employer's rich company profile — About us,
How we work, Benefits, team, testimonials, photo & video galleries, a
custom section — the perk phase 2's pricing copy had been selling
without it actually existing. A non-Top-Employer owner sees the same
editor blurred with a "become a Top Employer" teaser in their own
console, not hidden outright; the public profile page omits the
fields entirely for non-subscribers — no blur trick shown to
candidates. Verified live on both environments: a Top Employer fixture
filled and saved all eight pieces and confirmed they render publicly
in order with a Top Employer badge, jobs staying last; a non-subscriber
fixture confirmed the console blur/teaser and confirmed the public
page shows none of it.

**Phase 4 shipped**: Top Employer API access for programmatic job
posting — the last unbuilt perk from the pricing page, built for a
real pilot company to test. A key-authenticated REST API
(`/api/v1/jobs`, `/api/v1/reference`) that can list, create, read,
replace, pause, publish and delete job ads, speaking entirely in
human-readable slugs rather than internal ids. Access is gated live on
an active Top Employer subscription on every request, not just at key
generation. New `/recruit/api` console page: key generation (shown
once, never stored), in-product docs with real curl examples. Verified
live on both environments with the full HTTP lifecycle via curl — a
real key created and published a job that appeared on the public feed,
every state transition and error case (bad slug, missing field, a
job with applications, a lapsed subscription) checked directly against
the real API, not just code review.

**The real domain and real email are live**: `justit.pt` is registered
and serving the site; Resend is connected as a real, verified sending
domain (SPF/DKIM, its own free tier rather than Vercel's $20+/mo
marketplace listing); Supabase's own auth emails (verification,
password reset) go through the same domain via custom SMTP. Both send
paths verified against real inboxes, not just code review — a real
registration's confirmation email arrived and its link worked;
the app's own contact-form email was confirmed sent via Resend's own
API. One real gap surfaced and flagged, not silently assumed away:
`justit.pt` has no mailbox yet, so `hello@justit.pt` (the contact
form's destination) can send but nothing can read it — needs a real
mailbox provider next.

**Real public API documentation shipped**: `/developers` — a full,
public (no login needed) reference for the Top Employer job-posting
API, linked from the pricing page's API perk. Every error code and
job field documented matches the real code, not recollection. Caught
and fixed one small real bug along the way: the pricing-page link's
own text wrapped across two lines and had a dead click zone in the
gap between them — a real user could have hit it too, not just a test
artifact.

**Salary Calculator (Portugal), Phase 1 of 8 shipped**: a new lead-gen
feature against its own separate spec, scoped to the calculator only
(the spec's editorial content system and labour-law hub are explicitly
not MVP). Phase 1 is the pure engine — rules data + schema for 2026
Continente, the employment-contract (Mode A) calculation engine, no UI
yet. Built from the real AT-published withholding spreadsheets the
user provided (parsed programmatically, not retyped by hand) and
cross-checked against the spec's own stated known-good values before
trusting the result. Resolved one real ambiguity the spec had flagged
as unverified (which disability withholding table applies to a
two-earner household with dependents) directly from the official data,
and caught two real transcription mistakes before they shipped. See
`CLAUDE.md` for the honest list of what's deliberately not implemented
yet (IRS Jovem's exact monthly mechanic, duodécimos, a couple of
deduction edge cases the spec itself doesn't fully specify).

**Salary Calculator Phase 2 shipped**: a real, public, indexable page
at `/salario-liquido` — no login needed, linked from the candidate
Rail nav. The engine runs entirely client-side (no server round trip
per keystroke); IRS Jovem and the IFICI flat-20% regime, both already
built in Phase 1, are now real toggles in the UI; a shareable URL
encodes the whole scenario in the link, verified with a real
copy-paste-reload round trip. One real UI gap kept honest rather than
guessed: Madeira/Açores show no annual-settlement estimate yet (their
own IRS bracket data wasn't confidently sourced), with an explicit
note saying so — their monthly net is still fully accurate. Caught and
fixed a real `next-intl` bug along the way (a dynamic translation
lookup colliding with a plain-string key of the same name).

**Two real bugs fixed from live usage, not from any test**: duodécimos
(spread subsidy payments) silently didn't change the monthly net at
all — only the annual total — now fixed, with a test confirming the
right invariant (duodécimos change *when* the same annual pay arrives,
never *how much*). The meal allowance's default daily value was an
arbitrary placeholder; now defaults to the real, confirmed 2026 exempt
ceiling (€10.46/day). A third question — about amounts exempt from
IRS but not Social Security, or vice versa — was researched against
several real candidates (meal allowance, per-diem allowances,
performance bonuses) but none matched; still open, waiting on which
specific mechanism is meant.

Next up: a real mailbox for `@justit.pt` (in progress — you're
mid-testing this), then step 9 (SEO check, compliance, polish), and
continuing the Salary Calculator's remaining phases (Mode B — recibos
verdes, Mode C — Lda, the comparator, the lead-gen gate) (see
`CLAUDE.md`).
