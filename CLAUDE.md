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

**Step 4 (employer console) is done**, and expanded beyond its original
scope per a mid-step decision: the candidate surface (`/jobs`, `/jobs/
[slug]`, `/map`) now reads the real database instead of the `src/lib/jobs.ts`
fixture (steps 5/8 done early, on purpose — see `src/lib/db/jobs.ts`), a new
public `/companies/[slug]` page shipped (the job detail page's JSON-LD
`sameAs` already pointed at it, so real jobs without it meant a broken link
to every search engine), and Team/invite (§7.2) was built now rather than
deferred. Job descriptions are plain text (paragraphs split on blank lines)
— no HTML is ever accepted or stored, so there's nothing to sanitize.
Team invites don't send email (that's custom product messaging, out of
scope per §13/§9.1) — the owner gets a copyable `/employer/accept-invite/
<token>` link to share themselves. See `src/lib/db/` for the data layer and
the plan's git history for the full design.

Verified directly against the live database and through the real browser
UI (Playwright) — **against both `localhost:3000` and the actual
`https://soit.vercel.app` production deployment**, not just locally: draft
→ blocked publish while unverified → verified via direct DB update (VIES
has no real test NIF to resolve to `verified` — and the lazy-retry console
check will flip it right back to `failed` on the next page load unless
`verification_next_retry_at` is also pushed into the future, since a fake
NIF genuinely does come back `not_found` from real VIES) → successful
publish → visible on `/jobs`, the job detail page, `/map`, and the company
page; Company Profile edit + banner states; Team invite creation and
acceptance (a second employer_users row, `member` role, correct company,
invite `accepted_at` set).

**A third production incident, this one caught only because step 4 was
the first time an admin-client code path actually ran on Vercel in
production** (step 3's registration flow, which also uses the admin
client, was never fully driven through production due to email rate
limits): `SUPABASE_SERVICE_ROLE_KEY` threw `supabaseKey is required` in
every Server Component under `/recruit` — every one of them, via the
console layout's lazy-retry check, which always constructs the admin
client — even though `vercel env ls` showed it correctly set for
Production. Re-adding the exact same value with `vercel env add
SUPABASE_SERVICE_ROLE_KEY production --type secret --force` and
redeploying fixed it. Lesson: **redeploy after any Vercel env var change,
Secret or Config** — don't assume a server-only var is safe just because
it isn't `NEXT_PUBLIC_`, and don't assume `vercel env ls` showing the
right value means the running deployment actually has it. Root cause
unconfirmed (possibly this value was set before the project was fully
wired up, or something about how it was originally added); if it recurs,
that's the next thing to dig into.

**Two testing-methodology findings, not product bugs, worth remembering**:
`supabase.auth.admin.generateLink()` produces an *implicit-flow* link (no
`pkce_` prefix), which `/auth/callback` doesn't handle — real users get
PKCE links from `signUp()` and this was already verified working in step 3.
For a pre-confirmed test account with a session, prefer creating the user
via the admin client + calling `completeRegistration` directly, then
logging in through the real UI (`signInWithPassword`) rather than trying to
manufacture a confirmation link.

**Step 6/7 (apply + Applicants) is done, with a spec change decided
mid-planning**: you asked whether anonymous apply was really agreed, given
the bot/abuse risk — it wasn't something I had record of us changing, and
the spec as written made it deliberate (§6.7, "the growth loop and the
most exposed surface in the product"). **You changed the decision**:
apply now requires a verified candidate account. §6.7 (and §6.5, §6.6,
§7.1, §14 step 6, both Flow A/B diagrams — inline and their `.mmd` files)
were rewritten to v1.10 to reflect it, before any code — read §6.7 for the
current rules and what got dropped (per-IP limiting, Turnstile — both
existed specifically for the anonymous case) versus kept (content-sniffed
file type, 5MB cap, signed-URL-only CV access, live-job check — now an RLS
policy instead of app code). `complete-registration.ts`'s unclaimed-row
claiming branch (§6.5) is dead-but-correct code now — nothing creates an
unclaimed row anymore, left in place rather than ripped out of already-
verified step-3 code for a step that isn't touching it.

Built: `ApplyForm` (gates on a candidate session, routes a logged-out
visitor through candidate login/register with a `next` param back to the
job — same pattern as employer "Add offer"), content-sniffing by magic
bytes (`src/lib/file-sniff.ts` — never trust the extension or declared
MIME type), a per-candidate daily application cap (DB-backed, no new
infra), the candidate Applications dashboard, and the employer Applicants
view (CV access via a signed URL, ≤15 min, status updates). See
`src/lib/db/applications.ts`.

**Two real bugs found by testing this against the live database before
ever reaching the browser** (both fixed, both worth internalizing as
patterns, not just one-off fixes):
1. **RLS policies whose conditions read each other's table can recurse.**
   The new "candidates see jobs they applied to" policy on `jobs`
   subqueries `applications`; the existing "employers see applications to
   their company's jobs" policy on `applications` subqueries `jobs` right
   back — `42P17 infinite recursion`. Fixed with a `SECURITY DEFINER`
   helper (`candidate_applied_to_job()`), the same pattern
   `my_company_id()`/`my_candidate_id()` already use. Full writeup in
   `supabase/migrations/README.md`.
2. **An embedded join still goes through the joined table's RLS**, even
   when the top-level table's policy already let the query through.
   `getApplicantsForJob` embedded `candidates!inner(full_name, email)` —
   but `candidates` deliberately has no policy letting an employer read it
   (step 2's own schema comment: "Employers never read this table") — so
   every applicant silently vanished from the Applicants view. Fixed by
   fetching candidate info via the admin client instead, the same pattern
   Team's email lookup and the CV signed URL already use in this exact
   function.

Verified against the live database and through the real browser UI
(localhost — production wasn't re-verified this round since nothing about
Vercel/env vars changed; the lesson from steps 3-4 was specifically about
*that* class of issue, and this step's changes are all DB/RLS/app-code):
apply while logged out → redirected to candidate login with the job as
`next` → returns to the job after login → a renamed-`.exe` upload rejected
by content-sniffing → a real PDF accepted → double-apply blocked →
Applications dashboard shows it → employer's Applicants view shows the
candidate, cover note, and a working signed CV URL (confirmed serving
`application/pdf` from the Supabase Storage domain, not our own origin,
per §6.7) → status change to "Viewed" persists and reflects immediately on
the candidate's own dashboard. Test data cleaned up afterward, storage
objects included (candidate/company row deletion doesn't cascade-delete
the actual uploaded file — `storage.objects.remove()` needed separately).

**Real-usage QA (post step 6/7) reversed the apply-flow decision, spec
v1.11**: after using the live site yourself, you asked for three things at
once — reverse the "account required to apply" decision from step 6/7 back
to account-free (a modal, matching justjoin.it's reference flow you shared
screenshots of), build the full application-email flow now even though no
provider is plugged in yet, and add an optional per-job external apply URL.
`docs/mvp-build-spec.md` was rewritten first (§6.5, §6.6, §6.7, §7.1, §14
step 6, new §9.1a, both Flow A/B diagrams inline + their `.mmd` files),
tagged v1.11 and documented explicitly as a reversal of v1.10, not a silent
overwrite — same convention as every prior decision change.

What shipped:
- **`applyAnonymously()`** in `src/lib/db/applications.ts` — the account-free
  path, admin-client throughout (mirrors `complete-registration.ts`'s
  shape): live-job check, per-email daily cap, content-sniffed + size-capped
  CV upload (same helpers `applyToJob` already used, now shared via a
  `uploadCv()` helper), creates/reuses an **unclaimed** `candidates` row
  (§6.5) — but **rejects with `email_has_account`** if that email already
  belongs to a *claimed* account (`auth_user_id is not null`), so the
  v1.1-era exploit (attaching an anonymous application to someone else's
  real account) can't resurface. `complete-registration.ts`'s claim-by-email
  branch — dead code since step 6/7 removed anonymous apply — is live again
  unchanged; claiming a profile via real registration with the same email
  attaches any prior unclaimed applications automatically.
- **`ApplyModal`** (`src/components/ApplyModal.tsx`, replaces `ApplyForm`) —
  a real modal, not a redirect. Three branches: `externalApplyUrl` set →
  plain outbound `<a target="_blank">`, no modal, no application ever
  created for that job; logged-in candidate → CV + note only, name/email
  hidden; anonymous → full form + a required consent checkbox, and on
  success a confirmation view inside the same modal with a "Create your
  profile" CTA that deep-links to `/candidate/register?email=…`
  (`AuthForm` now prefills `email` from that query param).
- **External apply URL** — one nullable column (`jobs.external_apply_url`,
  migration `20260922130000_jobs_external_apply_url.sql`), one optional
  field in `JobForm`, threaded through `saveJob`/`JobFormInput` and
  `getLiveJobBySlug`/`JobDetail`. Simple branch, no new authorization
  surface: set → redirect only; unset → normal internal flow.
- **Email flow, built but not connected** (§9.1a) — `src/lib/email/`: an
  `EmailProvider` interface, a `ConsoleEmailProvider` that logs the fully
  rendered message instead of sending (visible in server/Vercel logs today),
  and two real templates (`application-confirmation.ts`,
  `new-applicant.ts`). `sendEmail()` is the one call site that picks the
  provider — swapping in Resend/Postmark later is a one-line change, not a
  redesign. Triggered from both `applyToJob` and `applyAnonymously` right
  after the application row is created: confirmation to the applicant,
  notification to every `employer_users` row of the company.

**One responsiveness bug found by testing, fixed the same way
`complete-registration.ts` already fixed an equivalent one for VIES**: both
notification emails were originally `await`-ed inline before the apply
Server Action returned, so the applicant's browser sat waiting through two
sequential sends (confirmation + N employer notifications, each doing an
`admin.auth.admin.getUserById` call) before the modal could show the
confirmation view. A second Playwright run against a fresh job caught it —
the DB write had actually succeeded already, but the UI hadn't updated
within a normal wait, i.e. a real UX latency issue, not a flaky test. Fixed
with `next/server`'s `after()` — wrapped in the same
`try { after(...) } catch { void fn() }` fallback pattern
`complete-registration.ts` uses — so the notification work runs after the
response is sent instead of blocking it. Re-verified: confirmation now
appears in ~1.3s and both emails still log with correct, fully-rendered
content.

Verified against the live database and through the real browser UI on
`localhost:3000`: anonymous apply with a real PDF → unclaimed `candidates`
row + application created, both emails log correctly → a second anonymous
apply attempt against the now-claimed email is rejected with a "log in to
apply" prompt, no application created → an external-apply-URL job's public
Apply button is a plain outbound link, no application ever created for it.
Test fixtures (one company under a fresh NIF, its jobs, employer/candidate
auth users, applications, and their CV storage objects) cleaned up
afterward, same as every prior step. `npx tsc --noEmit`, `npm run build`,
and `npm run test` all pass; `npm run check:i18n` reports both locales in
sync. Re-verified against `https://soit.vercel.app` production the same
way, with a fresh fixture created and cleaned up there too.

**Companies listing page + richer company profile**, the first item tackled
from that backlog: `/companies` (the "Empresas" rail link — already wired
to that path in `src/components/candidate/Rail.tsx`, just 404ing because
the page didn't exist) now lists every company with at least one live job;
the public `/companies/[slug]` page was redesigned per your rocketjobs.com
reference screenshot (banner + circular logo overlap, a social-links icon
row, a 4-card stat row — office locations / active offers / company type /
industry, each card omitted rather than shown blank when unset); the
console's Company Profile form gained a "Company type" field and 5 new
social-link inputs (Facebook/LinkedIn/Instagram/YouTube/TikTok/X, alongside
the existing Website), plus a "View public profile" link. Scoped down from
the full reference on your call: no Follow button (needs its own table/
auth — later), no AI-generated description or banner theme picker (AI work
is its own future track), and registry enrichment stays VIES-only (legal
name + verified badge — real address/size/founding-year data needs a paid
PT business-registry API that isn't set up).

Migration `20260922140000_companies_profile_fields.sql` adds the 6 new
`companies` columns and their own column-level grants. **A real bug found
by testing, not just the usual "did it deploy" check**: the new `/companies`
listing page originally filtered `.eq("verification_status", "verified")`
directly — but `verification_status` was never in the public column-select
grant (`supabase/migrations/20260921120100_rls.sql`, "NOT the verification
columns" — deliberate, `nif`/verification data are console-only, reachable
publicly only through the `my_company()` SECURITY DEFINER RPC). PostgREST
returned `42501 permission denied`, and the page's `if (!data) return []`
swallowed it into a silent empty list — no crash, no error surfaced, just
"no companies" on a database that had several. Fixed by deriving listing
membership from `jobs` instead (a company can't have a live job without
being verified — spec rule #2 — so "has ≥1 live job" is an equivalent,
privilege-clean proxy), rather than opening a new grant on a column this
project deliberately kept off the public surface. A second, smaller bug in
the same pass: a stat card referenced `t("industry")` under the `company`
i18n namespace, but that key had never existed there (only under `jobForm`/
`console`) — added it. Both caught by the same Playwright-against-the-
live-database method used throughout this project, not by `tsc`/`eslint`/
`build`, all of which passed the whole time.

Verified end-to-end, live database + real browser: `/companies` lists a
company with live jobs (including your own real "Test Company") and omits
a verified-but-jobless one; the profile page shows the gradient fallback
banner when no cover image is set, the circular logo overlap, only the
social icons that are actually filled in, and the stat-card row with a
card genuinely absent (not blank) when its field is unset; editing the new
console fields persists and shows up on the public page immediately
(`revalidatePath` on both `/recruit/company` and `/companies/[slug]`).
Test fixtures cleaned up afterward. Re-verified against
`https://soit.vercel.app` production the same way, fixture cleaned up
there too.

**Six quick bug fixes from that backlog**, all in one pass:

- **Delete-job button**: `deleteJob()` (`src/lib/db/jobs.ts`) + a "Delete"
  button on the Drafts tab (`src/components/console/JobListRow.tsx`, new —
  replaces the old row markup that lived inline in `recruit/page.tsx`),
  with a `window.confirm()` guard (this codebase's only destructive-action
  confirm so far — everywhere else, like Team's "Remove", just acts
  immediately; deleting a job felt like it warranted one). The `jobs.
  applications` FK is `on delete restrict` (schema §15.1) — a job with any
  applications can never actually be deleted, by design, so the button
  only appears on Drafts, which can't have any.
- **Job pause/deactivate + reactivate**: `setJobStatus()` — the `inactive`
  tab's *read* path already existed (`getCompanyJobs`), but nothing could
  ever *write* `status: 'inactive'`. "Pause" on the Active tab, "Reactivate"
  on the Inactive tab (only for jobs actually `status: 'inactive'`, not
  expired-published or closed ones) — reactivating renews the 30-day
  window, same as a fresh publish, so it's actually live again rather than
  instantly re-expiring.
- **Applicant count now links to Applicants**: it was already technically
  clickable (nested inside the row's one giant `<Link>`), but always went
  to the job's Edit page, never `/recruit/jobs/[id]/applicants`. Fixed by
  restructuring the row so the count is its own link.
- **"Duplicate draft" — investigated, turned out not to be a code bug**:
  `saveJob()`'s insert-vs-update logic is correct; editing a draft via its
  own `/recruit/jobs/[id]/edit` page always updates that row in place.
  The reported symptom is consistent with clicking "Add job advertisement"
  (a blank form) instead of the existing draft row. No fix needed there —
  but the new Delete button gives a real way out of the mess it leaves.
- **Dual-role signup**: `AuthForm.tsx` — Supabase Auth is one `auth.users`
  row per email for the whole project. `signUp()` against an email that
  already has a *confirmed* account (e.g. registering as a candidate with
  an email that already has an employer account) returns **200, no error,
  an empty `identities` array, and no session** — deliberately, to avoid
  leaking which emails are registered. The old code never checked for
  this, so it fell straight into "check your email," for a confirmation
  link that was never sent — an indefinite, silent dead end. Now checks
  `data.user?.identities?.length === 0` and shows a real "an account
  already exists" message instead. **This does not make one email hold
  both roles** — that needs a real "log in, then attach the missing
  role/profile to your existing account" flow, a bigger, separate feature;
  flagged, not built, since it wasn't asked for here.
- **Silent image-upload errors**: `uploadImageAction` threw plain,
  un-translated `Error`s with no client-side `try/catch` at all
  (`CompanyProfileForm.tsx`'s `handleImage` just `await`ed it) — a failed
  upload (wrong type, or a file over the `branding` bucket's 2MB cap)
  showed the user nothing. Reworked to return a structured
  `{ ok: false; reason }` instead of throwing, with client-side pre-checks
  and a translated message per reason. **Found a real, separate bug while
  testing this fix**: Next.js Server Actions default to a **1MB** request
  body limit — below the bucket's own 2MB image cap — so any upload
  between 1-2MB (which the bucket would happily accept) crashed with a raw
  framework 500 before the new size check ever ran. Fixed in
  `next.config.ts` (`experimental.serverActions.bodySizeLimit: "3mb"`).
  Caught by testing an oversized file, not by `tsc`/`build`/`eslint`.

Verified live, real browser, both locally and on `https://soit.vercel.app`:
pause → job moves to Inactive → reactivate → back on Active; delete a
draft → gone from the list; applicant-count link goes straight to
Applicants; a second registration attempt on an already-registered email
gets a clear error, not a silent hang; an oversized/wrong-type logo upload
shows the right message and doesn't crash the page; a valid small logo
still uploads and shows up normally. Test fixtures cleaned up afterward.

**Account basics** shipped next: candidate profile page, password change,
forgot-password, and team member profile fields (name, picture). One
migration (a shared `avatars` storage bucket, scoped by `auth.uid()` —
both candidates and employer team members manage their own folder in it,
mirroring `branding`'s shape but without an "owner" concept). Everything
else reused what already existed: `candidates` already had `full_name`/
`phone`/`cv_url`/`linkedin_url`/`avatar_url`/`skills` columns with RLS
granted for self-update (step 2 anticipated this), so the candidate
profile page (`/profile`) is mostly UI — a *master* CV upload/download
distinct from per-application CVs, reusing the same content-sniffing +
signed-URL patterns `applications.ts` already established. Team member
profiles don't touch `employer_users` at all — name/avatar live in
`auth.users.user_metadata` (same place `last_role`/`pending_nif` already
do), read off the `admin.auth.admin.getUserById()` call `getCompanyMembers`
already made for email.

Password change (`PasswordChangeForm`, shared between `/settings` and
`/recruit/settings`) is a plain client-side `supabase.auth.updateUser({
password })` — no Server Action needed, the live session is enough.
Forgot-password required extending `/auth/callback/route.ts`: it always
called `completeRegistration` + redirected to a role-based landing page,
which would have silently skipped the "set a new password" step entirely
for a recovery link. Added one branch — `type=recovery` in the query
string (carried through from `resetPasswordForEmail`'s `redirectTo`) skips
`completeRegistration` and lands on `/reset-password` instead.

**Two real bugs found by testing, not by `tsc`/`eslint`/`build`, both
worth reading closely:**
1. Both new `candidate-profile.ts` update calls (`updateCandidateProfile`,
   the avatar/CV writes) originally did a bare `.from("candidates").
   update(fields)` with no filter — RLS scopes *which* rows a query can
   touch, but PostgREST still hard-rejects an UPDATE with no WHERE clause
   at all, regardless of RLS ("UPDATE requires a WHERE clause"). Every
   other `.update()` in this codebase already had an explicit `.eq(...)`;
   this was a new-code mistake, not a repeat of an old one. Fixed by
   filtering on `id`/`auth_user_id` explicitly, the same as everywhere
   else.
2. **A real, pre-existing bug this session's testing was the first to
   actually trigger**: `getMyEmployerContext()` (`src/lib/db/companies.ts`)
   did `supabase.from("employer_users").select("id, role").single()` —
   no filter, relying on RLS. But the "see colleagues" policy on
   `employer_users` returns *every* row at the caller's company, not just
   their own (unlike `candidates`' RLS, which genuinely is `auth_user_id =
   auth.uid()`). `.single()` errors on more than one matching row, so
   **any company with a second team member broke the entire console** —
   My Job Ads, Company Profile, Team, everything under `/recruit` — the
   moment the owner (or any member) loaded a page, silently rendering
   "you don't have an employer profile" instead of a real error. This
   never surfaced before because no prior test session created a second
   *confirmed* member and then reloaded a console page as an existing
   member afterward. Fixed by filtering on `auth_user_id = auth.uid()`
   (unique per row) with `.maybeSingle()` instead of `.single()`. If
   you've been using a multi-person company account in production and
   hit an unexplained "not an employer" page, this was almost certainly
   why — it's fixed now, but production had this bug until this line
   deployed.

Verified live, real browser, real recovery email end-to-end (via
mailinator — same method used throughout this project): candidate edits
name/phone/LinkedIn/skills and it persists; uploads an avatar and a
master CV, downloads it back via a signed link; password change works and
the new password logs in afterward; forgot-password's real email arrives,
its link lands on `/reset-password` (not the normal role landing), a new
password there redirects correctly and logs in; an employer owner sets
their own name/avatar and both a second teammate *and* the owner's own
Team-page view show it correctly (this last check is exactly what
surfaced the `getMyEmployerContext` bug above — worth remembering as a
reason to always test multi-person scenarios, not just solo-owner ones).
Test fixtures cleaned up afterward, both locally and on
`https://soit.vercel.app`.

**Job browse pages** (justjoin.it-style `/job-offers/berlin/java`) shipped
next, and grew mid-plan into a bigger data-hygiene pass at your call: job
**category** (job function/domain — "Software Development", "Security")
didn't exist as a concept anywhere, distinct from tech tags (specific
technologies, unbounded per job — category is one required field per job).
Two new curated, RLS-public tables — `locations` (14 Portuguese cities,
seeded with real coordinates) and `job_categories` (14 job functions,
adapted from `tech_tags`' own seed-file section groupings) — replace what
used to be a free-text location `<input>` on `JobForm.tsx` with two
required `<select>`s. `saveJob` now looks up the picked city's name/lat/lng
by id instead of calling Nominatim per job — `src/lib/geocode.ts` is gone,
confirmed fully dead the moment location stopped being free text.

Routes: `/jobs/in/[location]` and `/jobs/in/[location]/[facet]` — a static
`in/` segment was necessary because `/jobs/[slug]` already owns the job
*detail* route, so a location can't live at that same dynamic-segment
level without colliding. `[facet]` resolves against **either**
`job_categories.slug` or `tech_tags.slug` (tried in that order) — one
shared URL slot for both taxonomies, matching justjoin's own mixing of
"java" and "analytics"/"devops" in the identical position, with
`all-locations` as the "any location" sentinel. Every valid combination
renders a real 200 with an empty state at zero jobs — the taxonomy is
legitimate before it's populated — but `src/app/sitemap.ts` (new; none
existed before) and the `/jobs` page's new "Browse by location/category"
links only ever point at combinations that actually have ≥1 live job,
computed from already-fetched data, not the full cross-product (14
locations × ~173 facets would be ~2400 mostly-empty URLs — bad for SEO,
not just wasted effort). `src/app/robots.ts` (new) points at the sitemap;
it doesn't duplicate the `noindex` that console/settings/auth pages
already declare per-page via their own metadata.

Category display anywhere in the UI goes through i18n by slug
(`jobForm.categoryOption.{slug}`), never the raw DB `label` — the DB
stores English only, same reasoning as why `job.tech` stays untranslated
(tech names like "React" aren't translatable) but category names clearly
are. `getBrowseJobs()` returns `facetKind` alongside the resolved label
specifically so callers can make that distinction correctly.

**Two real bugs found by testing, not by `tsc`/`eslint`/`build`:**
1. `getBrowseJobs()`'s tech-facet filter first tried appending a *second*
   `job_tech_tags(...)` embed onto the existing `SELECT` string to add
   `!inner`, which would have produced a duplicate/ambiguous embed.
   PostgREST's actual mechanism for "filter parent rows by an embedded
   resource's column" is forcing `!inner` onto the *existing* embed
   reference, not adding a parallel one — fixed via a targeted
   `SELECT.replace("job_tech_tags (", "job_tech_tags!inner (")`.
2. **The same `service_role`-grants gap this project already has one
   documented incident and migration for** (`20260922100000_service_role_
   grants.sql`) — Postgres's default privileges don't auto-grant
   `service_role` on new `public` schema tables (unlike Supabase-managed
   schemas), so the two new tables needed their own explicit `grant all
   ... to service_role`, or any admin-client read against them would 42501.
   Caught by my own verification script hitting exactly that error, not by
   the app itself (nothing in this feature happens to use the admin client
   against these two tables yet) — but it's exactly the kind of gap that
   bites the *next* thing that does, so it's fixed now rather than left for
   that to rediscover.

Verified live, real browser, jobs actually posted through the real
`JobForm` UI (not seeded directly) across two cities and three categories
plus one remote job: the picker saves correct location text/lat-lng/
category; editing preselects both; category is enforced as required
(blocked with a real error when left unset); `/jobs/in/lisboa` shows only
Lisboa jobs; `/jobs/in/lisboa/backend-development` and `/jobs/in/porto/
devops-cloud` narrow by category; `/jobs/in/all-locations/data-analytics`
catches the remote job (no location) by category alone; `/jobs/in/lisboa/
react` narrows by tech instead; an unknown location or facet slug 404s; a
real curated city with zero jobs (Coimbra) renders a genuine empty state,
not a 404; `/jobs`'s new browse-by sections and `sitemap.xml` both list
exactly the non-empty combinations — confirmed by literally reading the
generated sitemap. Test fixtures cleaned up afterward. Re-verified against
`https://soit.vercel.app` production the same way — a real job posted
through the live form (Braga, Cybersecurity), its browse pages and
sitemap entries all correct — fixture cleaned up there too.

**Same-email dual-role (§6.4a)** shipped next — the flagged item from the
bug-fix pass, built properly this time. Landed on the model you confirmed
across a few rounds: Supabase Auth is one account per email project-wide
(a platform constraint, not something this schema controls), so "two
independent password-protected accounts sharing an email" isn't
buildable — what's real and what you actually want is **one login, two
attachable profiles**. Acquiring either role still requires that role's
own full registration (the employer side specifically needs a real,
verified NIF), so sharing a login doesn't shortcut anything — it only
removes the dead end *after* someone has deliberately gone through the
second role's own signup. The attach is never silent: an explicit
confirm/cancel screen sits between "we detected this is really you" and
actually creating the second profile.

`src/lib/auth/complete-registration.ts`'s `completeRegistration(user)`
used to create *one* profile and hard-stop the moment any profile
existed — `if (existingEmployer) return ...` before ever considering the
other role. That's exactly what blocked dual-role. Split into two
idempotent, reusable functions — `ensureEmployerProfile(user, {nif,
companyName})` and `ensureCandidateProfile(user)` — each checking "do I
already have *this* role" instead of "does *any* profile exist yet";
`completeRegistration(user, intendedRole)` is now a thin dispatcher over
them for the confirmation-link path, with `intendedRole` required rather
than inferred. New `POST /api/auth/attach-role` calls the same two
functions directly, authenticated by session cookie only (never a
client-supplied user id) — for the *already-logged-in* attach case, where
there's no email confirmation link to click since the account was
already verified the first time around.

`AuthForm.tsx`'s register flow: on the existing `identities.length === 0`
signal (email already has a confirmed account — the enumeration-safe
response Supabase Auth returns), it now attempts `signInWithPassword`
with the exact email/password just typed, no re-entry. Wrong password →
the same `emailAlreadyRegistered` error as before (this doubles as
"someone guessing at a stranger's email," same failure mode as any login
attempt). Right password → a real session for their existing account, and
a new confirm screen ("You already have a {role} account with this
email — add a {role} profile to it?") before anything is attached.
Cancelling signs them back out — a session was a side effect of the
password probe, and leaving it active without consent isn't acceptable.

OAuth's role intent was a real, separate gap this surfaced: `signUp()`
carries `last_role` in its `data` option, but `signInWithOAuth` has no
equivalent metadata channel, so OAuth registration always silently
resolved to "candidate" regardless of which button was clicked — nobody
had hit this yet since OAuth is still inert (no credentials configured in
the Supabase dashboard). Fixed by passing `role` as an explicit query
param on the OAuth `redirectTo`, read by `/auth/callback` alongside the
metadata fallback. Verified by code review only — there's no way to
exercise a live OAuth round trip in this environment yet.

**A related, genuinely pre-existing bug fixed for free**:
`InviteAcceptForm.tsx`'s "login" mode (accepting a team invite while
already holding some account) used to just sign in and redirect to
`/recruit` — it never actually called the invite-acceptance logic, so the
`employer_users` row was never created and the invite never marked
accepted. It now calls the same `/api/auth/attach-role` endpoint with
`{role: "employer"}`, and `ensureEmployerProfile`'s existing invite-by-
email check picks it up — same mechanism, not a separate fix.

Verified live, real browser, real accounts (not seeded profiles for the
attach step — created via the actual register forms): a candidate
registering as an employer with their own real password + a valid NIF
sees the confirm screen, confirms, lands on `/recruit`, and a real
`employer_users`/`companies` row exists under their *original*
`auth_user_id`, NIF verification kicks off; the reverse (employer →
candidate) same. Wrong password on the second registration → the plain
error, no session established, no profile created — confirmed nothing
was created. Cancelling the confirm screen → signed out, confirmed no
employer/company row exists. A fresh invite accepted via "login" mode now
actually creates the `employer_users` row and marks the invite accepted —
confirmed via direct query, this was silently broken before. A brand-new
single-role registration (the common case, unaffected by any of this) was
spot-checked and still works normally. Test fixtures cleaned up
afterward, careful this time to use fresh, non-overlapping emails per
scenario after one early mix-up (a shared test email accidentally routed
through a real pending invite instead of the manual-NIF path — caught
immediately by checking the resulting DB row's company name, not a code
bug). Re-verified against `https://soit.vercel.app` production the same
way — wrong-password rejection, then a real attach confirmed by DB query
(`employer_users` row created under the candidate's original
`auth_user_id`, candidate row untouched) — fixture cleaned up there too.

**The browsing-engagement popup** shipped next — a growth nudge, not the
form-abandonment-recovery framing the original justjoin.it reference
suggested (corrected during triage): a signed-out visitor who's looked at
several different jobs in this browser gets a one-time popup suggesting
they create an account to track applications.

Entirely client-side, no new table, no server round-trip for the
tracking itself: new `src/components/EngagementPopup.tsx`, mounted on the
job detail page (`/jobs/[slug]/page.tsx`), tracks distinct job slugs
viewed in `localStorage` (`soit_viewed_jobs`) and shows the popup once
that count hits 3, provided (a) there's no active Supabase session at all
— checked client-side via `supabase.auth.getUser()`, so it's suppressed
for logged-in candidates *and* employers, not just candidates — and (b)
it hasn't already been dismissed (`soit_engagement_popup_dismissed`,
permanent per-browser once set — no cooldown/resurface logic, kept
deliberately simple). Both storage reads/writes are wrapped defensively
(private browsing / blocked storage must never break the page over a
growth nudge).

The shared modal wrapper that `ApplyModal.tsx` already had inline got
extracted to `src/components/Modal.tsx` so this could reuse the exact
same look instead of a second implementation — `ApplyModal` now imports
it too, no visual or behavioral change there.

Verified live, real browser: three distinct job views with no account →
no popup after 1 or 2, shows on the 3rd; dismissing it persists — a 4th
job view (even of an already-seen job) doesn't bring it back; a logged-in
candidate viewing 3 jobs never sees it at all; the "Create my account"
CTA links to `/candidate/register` and closes the popup on click. Test
fixtures cleaned up afterward. Not yet re-verified on production — do
that before considering this fully done.

Next: the rest of the real-usage QA backlog — bigger initiatives
(pricing/billing tied to AI-feature upgrade plans, and employer
analytics, both explicitly deferred to post-MVP) — plus step 9 (SEO
check + compliance + polish: Search Console, privacy policy, consent,
the §6.6 retention purge job, error monitoring), with map/visual design
polish deliberately last, per your own instruction.
