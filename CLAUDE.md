# Just IT — working notes

Renamed from SóIT on 2026-09-28 — see the dated entry near the end of this
file for the full rename writeup.

Transparency-first IT job board for Portugal. **`docs/mvp-build-spec.md` is the
source of truth** — read the relevant section before changing behaviour, and
update it *first* when adding a feature (§12.5).

## The two rules that define the product (§1)
1. Every listing shows a salary range. Posting without one is blocked.
2. Every employer is a verified business entity (NIF, §5.7).

## Conventions
- **Brand is `Just IT`** (§1) — every *pre-existing* machine-readable
  identifier stayed `soit` when the brand was renamed (npm package, repo/
  directory, localStorage keys, custom event names): purely internal,
  invisible to users, renaming them risked real regressions for zero
  user-facing benefit. Domain: `justit.pt`.
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
fixtures cleaned up afterward. Re-verified against
`https://soit.vercel.app` production the same way — no popup after 1 or
2 views, shows on the 3rd, stays dismissed — fixture cleaned up there
too.

**Two more curated browse facets** shipped next — "Languages" and
"Technologies," extending the location/category browse work. The
reference you shared (a justjoin.it homepage facet row) turned out to
mix specific languages and broad categories in one flat list; you
confirmed the actual ask is simpler: a small **featured** subset of the
159-entry `tech_tags` vocabulary — not a new taxonomy, not a real
language/technology split across all 159 rows. `tech_tags` gained one
nullable `featured_group` column (`'language' | 'technology'`, a check
constraint, most rows stay `null`); 10 languages (JavaScript, TypeScript,
Python, Java, C#, PHP, Go, Ruby, C++, SQL) and 10 technologies (React,
Node.js, AWS, Azure, Docker, Kubernetes, PostgreSQL, Angular, Spring
Boot, .NET) were marked, picked for real-world relevance rather than
derived from anything. New `getFeaturedTechCounts()`
(`src/lib/db/tech-tags.ts`) aggregates live-job counts for just those 20
in one query (small dataset, no per-tag query loop) — the `/jobs` page's
"Browse by X" section grew from 2 columns to 4, same "only show entries
that currently have ≥1 live job" rule as location/category. Both new
sections link through the *existing* `/jobs/in/[location]/[facet]`
route unchanged — `facet` already resolved against `tech_tags.slug`, so
no new URL scheme was needed.

**A third, distinct thing surfaced in the same conversation**: the job's
*ad language* (PT/EN — an existing `jobs.language` column, already shown
as a badge on every job card) wasn't filterable at all. Unrelated to the
language/technology *tech* facets above — this is the posting's own
language, not a skill. Added as a third small chip group in
`JobFeed.tsx` (client-side, same as the existing work-model/seniority
chips — a 2-value facet didn't need a URL-routed browse page).

Verified live, real browser: jobs actually tagged with featured tech via
direct fixture setup (not the picker — that stays the full 159-tag
list, unchanged), one PT/Python job and one EN/AWS job. The `/jobs` page
shows both new "Browse by" sections; the Python link lands on `/jobs/in/
all-locations/python` showing only the Python job; the AWS link shows
only the AWS job; the EN filter chip narrows to just the EN job. Test
fixtures cleaned up afterward. Re-verified against
`https://soit.vercel.app` production the same way — Java/Docker browse
links and the EN filter chip all correct — fixture cleaned up there too.

**A real bug report — "employer login just doesn't load, stays on the
login page"** — investigated and fixed. Reproduced consistently on
`https://soit.vercel.app` with a fresh test account: login *did* complete
and land on `/recruit`, but took ~3-4 seconds with **zero visual
feedback** during the wait — the submit button just sat there disabled
(50% opacity, easy to miss), same label the whole time. Entirely
plausible to read as "broken" over several seconds of apparent nothing.
Two real, separate fixes:
1. **Actual latency**: `/api/auth/landing` (`src/app/api/auth/landing/
   route.ts`) did three *sequential* network hops to Supabase before
   responding — `getUser()`, the `resolveLanding()` DB queries, then
   `updateUser({data: {last_role}})` — and that third one is pure
   bookkeeping (remembers which role to default to next login), not
   correctness-critical. Made it non-blocking via `after()`, the same
   fallback-wrapped pattern already used for `verifyCompany` and the
   application-email notifications — shaves a full Supabase Auth round
   trip off the critical path.
2. **Missing loading feedback**: `AuthForm.tsx`'s submit button (and the
   same-email dual-role attach-confirm button, and
   `InviteAcceptForm.tsx`'s submit button — same gap, same fix) now shows
   a spinner + "A entrar…"/"A criar conta…" while `pending` is true,
   instead of silently sitting disabled. This is the fix that actually
   matters most for the reported symptom — the latency reduction helps,
   but a few seconds of *visible* progress reads completely differently
   from a few seconds of apparent nothing.

Verified live: local timing improved to ~2.4s (was ~3-4s on production,
not independently re-measured locally pre-fix since the investigation
went straight to production); the loading state is clearly visible
mid-request in a screenshot taken during the pending window. Test
fixtures cleaned up afterward, including some left over from an earlier
interrupted investigation pass (a long idle gap mid-session — first
attempt hit a stale Playwright browser tripping `net::ERR_NETWORK_CHANGED`,
a false signal from the browser having sat idle for several minutes, not
a real bug — re-ran clean before concluding anything). Re-verified
against `https://soit.vercel.app` production after the fix, twice: ~2.5s
and ~3.0s (down from ~3-4s pre-fix), loading text visible immediately
both times — fixture cleaned up there too.

**A follow-up report on the same flow — "shows loading but then doesn't
move," and afterward appears logged in on the candidate page instead of
the employer console.** The reporter's own guess was that this was
caused by their email (`adregaconsulting@gmail.com`) being shared
between a candidate and an employer account — investigated and
disproven: a direct read of that account's real data (admin API,
read-only, no writes — that account's real "Test Company" was never
touched) showed no `candidates` row exists for it at all; it's a normal,
single-role, verified employer account. A fresh *generic* dual-role
account (seeded with both a `candidates` row and an `employer_users`
row on one `auth_user_id`) also logged in correctly in ~2-3s on both
localhost and production, ruling dual-role out as the mechanism
entirely.

The actual bug was a second layer underneath the latency/feedback fix
above: `handleSubmit`/`handleAttachConfirm` in `AuthForm.tsx` (and
`InviteAcceptForm.tsx`'s `handleSubmit`) reset `pending` to `false` in a
`try/finally` tied only to the preceding `fetch()` promise — but the
actual page transition triggered by `router.push()` (from `@/i18n/
navigation`) is a separate, *untracked* async process: an RSC fetch plus
a client-side render swap that component state has no visibility into.
Re-examining the prior fix's own test logs showed the submit button
reliably flipped back from "A entrar…" to "Entrar" about a second
*before* `window.location.pathname` actually changed — on a slower
connection or a colder server response, that gap can stretch much
further, leaving the button looking idle/done while nothing has
actually happened yet, which reads exactly as "stuck." The second
symptom (logged in on the candidate page after navigating away
manually) is explained by the same root cause, not a separate bug:
`signInWithPassword` itself had already succeeded and established a
real session — only the employer-specific redirect afterward was
failing to visibly complete — so manually visiting the site correctly
showed them signed in.

Fix: every early-return path that does *not* navigate away (validation
errors, auth errors, the `attachOffer`/`checkEmail` in-page state
switches) now resets `pending` explicitly; every path that calls
`router.push()` deliberately leaves `pending` as `true`, so the loading
UI stays visible continuously through the whole navigation handoff
instead of flickering back to idle first. Verified with a timing-logged
Playwright script (polls `window.location.pathname` and the button's
text every ~0.3s) against a fresh employer account: locally, the button
showed "A entrar…" continuously from submit through the real navigation
landing on `/recruit`, with zero window where it looked idle before the
page had changed. Same script, same result, re-verified against
`https://soit.vercel.app` production — fixture cleaned up both times.

**A real-usage report questioning why an employer session has any path
into the main candidate site at all** — "Voltar ao site" in the console
Sidebar, and clicking "Ver perfil público" on the company profile page,
both drop a company account onto the full candidate-facing shell, which
felt architecturally wrong ("they have no business there") — plus a
specific claim that navigating there and clicking "As minhas
candidaturas" showed 2 applications under the company account. That
last part was investigated first, since if real it'd be a serious
cross-account data-scoping bug: "My applications" (`getMyApplications()`
in `src/lib/db/applications.ts`) has **no explicit filter at all** — it
relies entirely on RLS (`candidates see their own applications`, scoped
by `my_candidate_id()` = the `candidates` row whose `auth_user_id =
auth.uid()`), so it can only return an employer's own applications if
that specific auth user genuinely has a linked `candidates` row.
Direct, read-only inspection of the live database found: zero dual-role
accounts exist anywhere (only one `employer_users` row total, one
claimed `candidates` row total, unrelated to each other); the specific
reporter's account has no `candidates` row at all, claimed or otherwise
— just one *unclaimed* application (an anonymous v1.11 apply, auth_user_id
null, invisible to any session's RLS scope since nothing auto-claims it
on employer login). The 2-applications claim couldn't be reproduced or
corroborated from stored data even after the user confirmed it happened
in the same tab/session right after clicking "Voltar ao site" — flagged
back to the user as unresolved, asked for a screenshot/exact URL rather
than guess at a fix for a bug that isn't reproducible server-side.

The "Ver perfil público" part **was** concrete and fixed: it already
opened in a new tab, but that tab carried the full candidate shell
(TopNav's search/login menu/"Publicar vaga", the Rail's Jobs/
Applications/Companies/etc.) — a real path from a one-off preview into
browsing the whole main site. Its content (banner, logo, socials, stat
cards, open jobs) was extracted into a shared `CompanyProfileBody`
component, reused by both the unchanged canonical `(candidate)/
companies/[slug]` page and a new noindex `(preview)/companies/[slug]/
preview` route under a new minimal `(preview)` layout (brand mark + a
"Pré-visualização"/"Preview" badge only — no Rail, no TopNav, no search,
no login menu). Next.js layouts don't receive `searchParams` (only
`page.tsx` does), so a real "stripped nav" variant needs its own route
group on a distinct URL rather than a query-param toggle on the existing
layout — this mirrors the existing `(auth)` route group's minimal
`AuthHeader` pattern, already used for the same reason. The console
button now links to `/companies/[slug]/preview` instead, still
`target="_blank"`. "Voltar ao site" itself was left as-is — the user's
own message trailed off with "but ok," reading as noting the oddity
rather than asking for a change, and removing it is a bigger call
(would an employer legitimately want to browse the main job board at
all?) worth raising explicitly rather than deciding unilaterally.

Verified live: a fresh test employer's "Ver perfil público" opens the
new `/preview` URL in a new tab with no search input, no `/jobs` links,
no logout control, no "Publicar vaga" button, the preview badge visible,
correct company content, zero console errors — confirmed on both
localhost and, after a redeploy (the first push hit a transient
Turbopack/Google-Fonts build error on Vercel's infra, unrelated to this
diff — a plain retry succeeded), `https://soit.vercel.app`. Regression-
checked the canonical `/companies/[slug]` page separately: full nav and
"Publicar vaga" still present, no preview badge — unaffected. Fixtures
cleaned up both times.

**The "2 applications" report turned out to be real** — the user came
back with a screenshot: `soit.vercel.app/pt/applications`, logged in as
the employer (`adregaconsulting@gmail.com` visible top-right), "As
minhas candidaturas" listing 2 real applications to their own "AI
Engineer" job at "Test Company." Root cause: `applications` has two
permissive RLS SELECT policies (`supabase/migrations/20260921120100_
rls.sql`) — "candidates see their own applications" and "employers see
applications to their company's jobs" (the latter exists for
`getApplicantsForJob`, the console's real Applicants view). Postgres
combines permissive policies with OR. `getMyApplications()` in
`src/lib/db/applications.ts` ran a fully **unfiltered** `.select()` and
relied entirely on RLS to scope it — so an employer session got the
union of both policies: every real applicant to their own jobs,
rendered under "my applications." Not a self-referential mix-up; real
other people's application data, just under the wrong label. This is
exactly why the earlier read-only DB check (candidate row is null,
zero applications tied to `auth_user_id`) came back clean — that check
was correct, but it tested the wrong mechanism; the actual leak route
was RLS's second, employer-facing policy, invisible to a query that
filters by `auth_user_id` directly instead of reproducing what the app
itself does. Confirmed by direct reproduction: signed in as a fresh
test employer with a real job and a different real applicant, the old
unfiltered query returned that applicant's row; explicitly scoping by
`my_candidate_id()` (an existing, already-granted RPC) returns nothing,
correctly, since that employer has no candidate profile. Audited every
other `applications` query in the same file for the same defect —
`getApplicantsForJob` (filters by `job_id`) and
`updateApplicationStatus` (filters by `id`, `UPDATE (status)` grant
only) were never affected; `getMyApplications()` was the only unscoped
one. Fixed by adding the explicit `.eq("candidate_id", candidateId)`
filter (short-circuiting to `[]` when the RPC returns null) rather than
trusting an unfiltered `select()` to land on the one RLS policy the
caller has in mind — the lesson worth keeping: an unfiltered query
under RLS is only as scoped as the *narrowest* applicable policy, and
Postgres doesn't guarantee that's the one you're thinking of once a
second, broader policy exists for a legitimate different feature.

Same message also settled the open design question from the previous
pass with an explicit instruction: **"when you are logged as a company
you should never be able to go to the main page of jobs."** Implemented
as a real guard, not just removing a button: `(candidate)/layout.tsx`
now checks, for any authenticated user, whether they have an
`employer_users` row but no `candidates` row, and redirects straight to
`/recruit` before any of the shell renders — covers every entry point
(direct URLs, bookmarks, the old "Voltar ao site" link) in one place. A
genuine dual-role account (§6.4a — has both) is unaffected, since the
whole point of that feature was letting one login hold both surfaces
legitimately. The check deliberately fails open on any error (try/
catch around the two lookups, `redirect()` kept outside the try so its
internal throw is never swallowed) — this layout wraps the entire
public, SEO-critical job site, so a broken session cookie must never
turn into a 500 for an anonymous visitor; worst case is just skipping
the redirect. The now-dead "Voltar ao site" link is removed from the
console `Sidebar`, and its unused `backToSite` i18n key dropped from
both catalogues.

A live dev-server hiccup during this pass is worth recording since it
looked alarming in the moment: after several `kill -9` + restart cycles
on the local dev server, `/pt/jobs` and `/pt/recruit/*` all started
500ing instantly (sub-millisecond "application-code" time in the logs)
with `SyntaxError: Unexpected non-whitespace character after JSON` —
reproduced even with zero cookies, ruling out a corrupted session
cookie. Turned out to be a corrupted Turbopack dev cache, not a code
bug — `rm -rf .next` and a clean restart fixed it immediately, and it
never appeared on Vercel's own from-scratch production builds.

Verified live: signing in as a fresh test employer and navigating
directly to `/applications`, `/jobs`, and `/companies` all immediately
redirect to `/recruit` — confirmed on both localhost and
`https://soit.vercel.app`. Separately, a raw `signInWithPassword` +
direct query against that same employer session (bypassing the UI
guard entirely, to test the query fix in isolation) reproduced the old
leak and confirmed the new one returns nothing — same result on both
environments. All fixtures (company, job, real applicant, employer
account) cleaned up on both.

**A third round of real-usage QA came in as 14 notes at once** — nav,
the whole candidate landing page, search, favorites, job posting. Big
enough to plan properly: sequenced into 5 phases (nav/chrome quick wins
→ job deadline+urgency badge → favorites → the map/list landing
redesign → search+saved search), each independently shippable, per your
own call to do quick wins first and the big redesign last. Two scoping
calls made with you up front: saved-search notifications ship as
save/manage only for now (no real email sender or cron exists yet —
that's separate follow-up), and the map's tile-provider licensing gap
(flagged in code as dev-only) stays untouched, out of scope here even
though the map gets rebuilt in a later phase. Full plan retained at
`~/.claude/plans/refactored-zooming-wren.md` for the remaining phases.

**Phase 1 (nav/chrome) shipped**: six related fixes.
1. `LoginMenu`'s signed-in state showed the raw email as plain text —
   now a circular avatar (the candidate's own photo if set, else
   initials) opening a real nav menu (Offers/Map/Applications/
   Companies/Profile/Settings + Log out). `Rail` is `hidden sm:flex` —
   there's no left-nav at all below that breakpoint — so this dropdown
   is the *only* nav mobile visitors get, which is why it deliberately
   mirrors Rail's own destinations rather than just being a logout
   button. Needed one new client-side query: avatar/name live only on
   `candidates` (`candidate-profile.ts`), never synced to
   `user_metadata`, so `LoginMenu` now also reads
   `full_name`/`avatar_url` on the same `onAuthStateChange` listener it
   already had.
2. "Add offer" rendered unconditionally in `TopNav` regardless of auth
   state — a real bug, a logged-in candidate has no use for it. Folded
   into `LoginMenu` itself (the one place that already knows auth
   state) instead of adding a second auth read elsewhere; now only
   renders in the logged-out branch.
7. `Rail` was permanently fixed with no way to collapse it. Now a
   per-viewer `localStorage` preference (not account data — no new
   column). Built with `useSyncExternalStore` rather than
   `useState`+`useEffect` — reading `localStorage` then `setState`-ing
   it inside an effect is exactly the cascading-render pattern
   `react-hooks/set-state-in-effect` flags (a real lint error this pass
   hit and fixed before it ever reached a browser); a custom
   `window` event covers same-tab reactivity since the native `storage`
   event only fires in *other* tabs, never the one that wrote it.
11. No footer existed anywhere in the codebase. New `Footer.tsx`: a
    page-links row + a LinkedIn icon, then a legal-links row + a
    copyright line. The LinkedIn icon only renders when
    `NEXT_PUBLIC_LINKEDIN_URL` is actually set in the environment — you
    confirmed the real URL doesn't exist yet, and guessing/hardcoding
    one would be genuinely misleading if wrong, so it stays unset
    (icon simply doesn't render) until you have the real one. New
    `(legal)` route group with its own minimal shell for `/privacy` and
    `/terms` — placeholder content only ("this page is being prepared"),
    since real policy/terms copy is separate, already-tracked backlog
    (§9's compliance pass) and not something to fabricate here. Footer
    is wired into `(candidate)` and `(auth)`, deliberately **not**
    `(preview)` — that layout was stripped of every site-nav link last
    session specifically so an employer's own-profile preview tab can't
    lead into the main site; a footer with Jobs/Companies links would
    silently reopen exactly that gap.
13. New `brand.navTagline` i18n key under the wordmark in `TopNav`
    ("#1 IT Job Board in Portugal" / a natural PT phrasing, not a stiff
    literal translation) — kept distinct from the pre-existing
    `brand.tagline` ("Só vagas de IT. Sempre com salário."), which is
    still doing its existing jobs (the page meta description, and the
    `/jobs` page's own header subtitle) and wasn't touched.
14. `LanguageSwitcher` showed both PT and EN as always-visible buttons
    side by side — now a compact current-locale trigger opening a small
    dropdown, same `<details>/<summary>` disclosure pattern already
    used by `LoginMenu` (no new dependency).

Verified live with a fresh candidate fixture on both localhost and
`https://soit.vercel.app`: tagline visible, single language trigger,
"Add offer" correctly shown to an anonymous visitor and hidden for a
logged-in candidate (scoped to the header specifically — the footer's
own persistent "Publicar vaga" link is separate and intentional, and a
naive test locator matching it first read as a false failure before
the mistake was caught), avatar shows the candidate's initial with no
raw email text, the dropdown has Settings/Log out, rail collapse
persists across a reload, language dropdown lists both locales,
`/privacy` and `/terms` both load. One test-environment red herring
worth recording: rail-toggle clicks kept timing out/silently failing
in Playwright — turned out to be Next.js's own dev-mode indicator
overlay sitting at the exact bottom-left corner where the collapse
button renders, swallowing the physical click at the browser's
hit-testing level even with Playwright's `force: true` (which only
bypasses Playwright's *own* pre-click checks, not real browser
hit-testing) — switching to a DOM-level `element.click()` for that one
interaction fixed it; never an app bug. Fixtures cleaned up on both.

**Phase 2 shipped**: job expiry used to be entirely automatic — always
`published_at + 30 days`, hardcoded in two places (`saveJob`,
`setJobStatus`), never exposed as a form field, not even selectable
when editing. Added an optional "valid until" date to `JobForm`,
threaded through `JobFormInput`/`saveJob()` (the employer's date wins
when provided and genuinely in the future; falls back to the existing
30-day default otherwise, so "leave it blank = 1 month" was already
true and just needed to become an explicit, editable behavior rather
than the only behavior) and `getJobForEdit`'s select list (previously
omitted `expires_at` entirely, so edit mode couldn't show or change
it). New `Job.daysLeft` (null for a never-published draft) computed
alongside the existing `postedDaysAgo`; a new amber "N days left"
badge on `JobRow` and the job detail page when `daysLeft <= 7`, same
visual language as the existing mint "NEW" badge.

**A real, genuinely serious bug was caught during this phase's own
production verification step — before the user ever saw it**: employer
(and, by the identical mechanism, candidate) login got stuck showing
"A entrar…" forever on `https://soit.vercel.app`, but never on
localhost, and the underlying `signInWithPassword` + `/api/auth/
landing` calls both demonstrably succeeded (confirmed via full network
capture) — the client-side `router.push()` to the landing page just
never visibly completed. Root cause traced to *last session's own*
Phase 1 footer work: `Footer` renders on the `(auth)` login page itself
and has a plain `<Link href="/recruit">` (and `href="/jobs"`). Next's
automatic Link prefetching — far more aggressive in a real production
build than in dev, which is exactly why this never surfaced during
Phase 1's own local *or* production verification, only once Phase 2's
employer-login-heavy testing hit it — fetched those paths in the
background the instant the login page loaded, while still
unauthenticated, getting back a redirect-to-login response that landed
in the client Router Cache under the exact path the real post-login
navigation needed a fraction of a second later. The stale pre-auth
entry won the race, and the button's (correctly persistent, per an
earlier session's fix) loading state just never got to flip because the
navigation it was waiting on had silently already lost. Fixed with
`prefetch={false}` on every `Footer` link — a static utility footer has
no real need for eager prefetching, and this was the one case where a
footer link's destination coincided with a real post-action navigation
target. Deployed and re-verified immediately, both employer and
candidate login confirmed landing correctly on production afterward,
before continuing with anything else.

Verified live on both localhost and (after the hotfix)
`https://soit.vercel.app` with a fresh verified-employer fixture: a job
published with a 5-day deadline shows the badge on the feed (checked
from a separate anonymous browser context, since an employer session
can't browse the candidate site at all per an earlier fix) and its own
detail page; a job published with no deadline chosen shows no badge,
with its stored `expires_at` confirmed directly against the database
at ~30 days out; the edit form correctly pre-fills a previously-chosen
deadline. All fixtures cleaned up on both environments.

**Phase 3 shipped**: candidates can now save a job to review later.
New `favorites` table (`candidate_id`, `job_id`, unique pair), RLS
scoped via the existing `my_candidate_id()` helper — insert/delete
happen directly from the browser client under RLS, no admin client
needed since a candidate only ever touches their own rows. A second
migration adds `candidate_favorited_job()`, a `SECURITY DEFINER`
function mirroring the existing `candidate_applied_to_job()` exactly,
so a saved job stays visible on `/favorites` even once it's no longer
live — same reasoning as the applications precedent (§6.7), and
deliberately the same SECURITY DEFINER shape from the start rather
than a raw correlated subquery, to stay clear of the exact
cross-table RLS recursion this codebase already hit and fixed once
(see the "RLS policies that subquery each other's table can recurse"
note in `supabase/migrations/README.md`) — even though this specific
case is one-directional (favorites' own policy never reads from jobs)
and wouldn't actually recurse.

`src/lib/db/favorites.ts` mirrors `applications.ts`'s own shape
(`toggleFavorite`/`getMyFavoriteJobIds`/`getMyFavoriteJobs`).
`jobs.ts`'s previously module-private `SELECT`/`toJob`/`JobRow` are now
exported so favorites can reuse the exact same job-card query shape
instead of duplicating it. `Job` gained a real `id` field — it was
already being selected everywhere via the shared `SELECT`, just never
actually mapped onto the type (only `JobDetail` had it) — since
favorites need the job's real id, not just its slug.

`FavoriteButton` (the heart toggle) renders as a sibling of `JobRow`'s
own `Link`, not nested inside it — an interactive control inside an
anchor is invalid HTML — with its own `stopPropagation` so clicking it
doesn't also trigger the row's navigation. `JobRow` only renders it
when an `isFavorited` prop is explicitly passed in; `getMyFavoriteJobIds()`
deliberately returns `null` (not an empty array) for a non-candidate
viewer specifically so callers can tell "a candidate with zero
favorites" apart from "don't show hearts to this visitor at all" and
skip the prop entirely for an anonymous visitor, rather than showing a
heart that would just fail on click. New `/favorites` page (same shell
as `/applications`) renders the full `JobRow` card rather than a
lightweight list item, since favorites carry the whole job. Rail's
`favorites` item (a disabled placeholder since it was first built) and
`LoginMenu`'s dropdown (which Phase 1 left a forward-reference to) are
both wired up now.

Verified live on both localhost and `https://soit.vercel.app`: an
anonymous visitor sees no heart buttons at all; a candidate can
favorite a job from `/jobs` without the click navigating away, see it
on `/favorites`, and un-favorite it there; a second candidate's
`/favorites` stays empty despite the first candidate's favorite — RLS
isolation exercised end-to-end through two real logged-in sessions
rather than just checked via a raw SQL role simulation; a favorited job
stays visible on `/favorites` after being manually expired directly in
the database, while correctly dropping off the live `/jobs` feed at the
same time. Fixtures cleaned up on both.

Next: the landing-page redesign, then search — per the plan above —
followed by the rest of the real-usage QA backlog: bigger initiatives
(pricing/billing tied to AI-feature upgrade plans, and employer
analytics, both explicitly deferred to post-MVP) and step 9 (SEO check
+ compliance + polish: Search Console, real privacy/terms content,
consent, the §6.6 retention purge job, error monitoring), with
map/visual design polish deliberately last, per your own instruction.

**A design ask arrived mid-batch, out of numbered-item order**: two
reference screenshots of a collapsible rail pattern (justjoin.it-
style) — collapsing removes the rail from layout entirely, replaced by
a small floating vertical tab fixed to the left edge with rotated
text, rather than shrinking to a thin icon strip; the current section
gets a soft blurred highlight behind its icon. `Rail.tsx` restyled to
match: toggle moved to the top with a rounded-panel "collapse sidebar"
glyph, `usePathname()`-driven active state with a `bg-pine/10` blurred
highlight (the app's own accent color, not the reference's purple),
collapsed state is a `fixed`-positioned tab reusing phase 1's existing
`rail.expand`/`rail.collapse` i18n keys — no new ones needed. Kept the
real feature set (Offers/Map/Applications/Companies/Favorites/Profile/
Settings) rather than copying every icon shown in the reference —
several (notifications, chat, trending) don't correspond to anything
this app actually has yet. Verified live on both localhost and
`https://soit.vercel.app` — expanded/collapsed states screenshotted and
visually compared against the reference, nav + active-highlight
tracking confirmed by actually clicking through routes, collapsed
persistence across a reload confirmed, zero console errors on
production.

**Phase 4 shipped**: the biggest piece of this QA round — merges the
old separate `/jobs` (list + ephemeral client-state chip filters) and
`/map` (unfiltered list+map, no filters at all) into one split-view
landing page. `/map` now permanently redirects to `/jobs` rather than
404ing — real bookmarks/indexed links may still point there. New
`JobsExplorer.tsx` replaces `JobFeed.tsx` on the main landing page only
— the `/jobs/in/[location]/[facet]` browse pages still use the
original `JobFeed`, untouched, since they already have their own
URL-encoded facet via the route itself and weren't part of this ask.

The real architectural change: filter state moved from local
`useState` to the URL — this is what actually fixes item 12 ("map
disappears when filtering"), since list and map now read from the
exact same filtered array in one parent component instead of being two
separate pages with two separate unfiltered fetches. Item 4's filter
row is curated-only (`getFeaturedTechCounts()`'s 20 tags +
`getJobCategories()`'s 14 categories, never the full ~159-tag
vocabulary companies actually pick from), with a "More filters" toggle
panel for the rest — work model (minus remote, which deliberately gets
its own quick toggle per item 5 so there's exactly one control for
that dimension, not two that could disagree), seniority, ad language,
salary floor. Item 6 is a result-count line directly above the list.

**A real, genuinely serious bug was caught and fixed during this
phase's own production verification, before it ever reached the
user — the second time this exact kind of thing happened in this same
QA round** (the footer-prefetch login bug in phase 2 was the first):
every single filter chip click was firing a real ~650ms
`GET /jobs?tech=...&_rsc=...` network round trip on production, network-
captured directly to confirm it, never visible locally (same round
trip is near-instant to a same-machine dev server). Root cause:
`next/navigation`'s `useSearchParams()` + `router.replace()` looks like
a same-page, client-only URL update, but on a page with no static
generation (this one fetches fresh every request), Next's client
router treats *any* searchParams-only navigation as needing a real RSC
round trip — regardless of whether the page's own data-fetching
actually reads those params, which here it doesn't at all (`JobsExplorer`
already has the full job list as a prop and filters it entirely
client-side in a `useMemo`). That round trip was pure waste on every
click, undermining the exact design principle ("purely a client-side
interactive refinement," already documented in the original `JobFeed`'s
own comment) this component was built to preserve.

Fixed by bypassing `next/navigation`'s router entirely for this one
interaction: a `useSyncExternalStore`-based reader (a cached
`URLSearchParams` parsed from `window.location.search` — same pattern
`Rail.tsx`'s collapse state already uses) plus a writer that calls
`history.replaceState()` directly and dispatches a custom event for
same-tab reactivity, since `replaceState` never fires `popstate` in the
tab that called it. Filtering is now truly instant (confirmed:
list updates within ~50-100ms, zero network requests fired, on both
localhost and production) while the URL still updates for shareable/
bookmarkable filtered views. A second, smaller bug turned up in the
same re-verification pass: `getServerSnapshot()` returned a fresh `new
URLSearchParams()` on every call — exactly the anti-pattern React's own
`useSyncExternalStore` warns about — fixed with one shared empty-params
instance.

Verified live on both localhost and `https://soit.vercel.app` with a
fresh fixture (a remote React/senior job and an office Python/junior
job in Lisboa, published at different times): both visible initially
with the map rendered; the React quick-filter chip narrows to just
that job while the map keeps rendering (the item-12 regression test)
and the URL picks up `?tech=React`; reloading that exact filtered URL
reproduces the same filtered view; the category chip and remote-only
toggle each narrow correctly; sorting by salary orders the higher-paid
job first; the count line reads correctly; the more-filters panel
opens; the map hide toggle removes it; no horizontal overflow at
400px viewport width. Fixtures cleaned up on both environments.

**Phase 5 shipped**: item 8, the last phase of this QA round —
TopNav's decorative, non-functional search `<input>` is now real:
title keyword (`q`) + "near a curated city within N km" (`near`/
`radiusKm`), centered in the nav. No geocoding provider needed for the
radius search: every curated location (`getLocations()`, now also
carrying `latitude`/`longitude`) already has fixed coordinates, and
every job's own lat/lng is already fetched, so it's just another pure
client-side Haversine filter in `JobsExplorer` — the same pattern as
its existing `monthlyFloor()`-based salary filter, no new Postgres RPC.
Submitting from any other page does a real navigation to `/jobs`
(correctly — a genuinely new page); submitting while already on `/jobs`
merges the search into the URL in place via the same instant,
no-round-trip mechanism phase 4's filters use, preserving whatever chip
filters are already active there rather than silently resetting them.
That mechanism (`useUrlSearchParams`/`writeUrlSearchParams`/
`parseListParam`) moved out of `JobsExplorer.tsx` into a shared
`src/hooks/useUrlSearchParams.ts`, since `SearchBar` — a different
component tree, mounted in `TopNav` — needs the exact same read/write
path for the list/map to actually react to a search submitted from
there.

New `saved_searches` table (`candidate_id`, `label`, `query` jsonb,
unique on the pair) — same RLS shape as favorites, via
`my_candidate_id()`. Per your own call last phase, no email/
notification delivery is wired up (still no real sender or
scheduled-job infra in this project) — this ships save/list/delete
only, and the UI never claims otherwise. The "save" icon sits next to
the search bar and is visible to anyone, logged in or not — an
anonymous click here is a real, expected path, not an exceptional one,
so `saveSearch()` returns a typed result instead of throwing for that
specific case (unlike favorites' toggle, only ever reachable by a
session already confirmed to be a candidate) — it doesn't surface as
server-log noise for ordinary use, caught and fixed during this
phase's own verification. New `/saved-searches` page, reachable from
`LoginMenu`'s dropdown.

**A second and third real bug were caught and fixed during this
phase's own production verification — the second and third time in
this same QA round a bug surfaced only against production, never
locally** (after phase 2's footer-prefetch login hang and phase 4's
filter-click round trip): first, the exact same "server round trip
where an instant client update was expected" class of bug phase 4 had
already fixed once, this time in `saveSearchAction`'s error path —
fixed by returning `{ ok: false, reason }` instead of throwing, as
above. Second, a genuinely new one: a `"Cannot read properties of
undefined (reading '_leaflet_pos')"` crash from `JobMap.tsx`, traced to
a pre-existing pattern from phase 4's merge (never exercised enough to
surface until phase 5's search added more paths that change the
filtered job list) — its one effect depended on `[jobs]` and tore down
+ recreated the *entire* Leaflet `Map` instance on every filter/search
change, which raced with Leaflet's own internal async/animation-frame
bits under real network latency between page transitions. Reproduced
the identical interaction sequence locally first to confirm it
genuinely didn't happen there (it didn't — zero errors both times),
ruling out a logic bug before concluding it was timing-specific to
production. Fixed by splitting into two effects: a mount effect that
creates the map and an empty marker layer group exactly once, torn
down only on real unmount; and a markers effect that clears/redraws
that layer group on `jobs` changes without touching the map instance
itself. Rewriting this surfaced a third, smaller issue: `routerRef`/
`labelRef` were already being mutated directly in the render body — a
real latent "Cannot access refs during render" violation in the
pre-existing code that had simply never been linted before, since
`JobMap.tsx` had never been touched (and therefore never `eslint`'d) in
any earlier phase of this batch. Fixed by moving each into its own
`useEffect`.

Verified live on both localhost and `https://soit.vercel.app`: keyword
search from a non-`/jobs` page does a real navigation to `/jobs?q=...`;
searching near Lisboa within 10km correctly shows a Lisboa job and
hides a Porto one; saving while logged out shows the login-prompt
message with zero server errors; logging in and saving succeeds, shows
up on `/saved-searches`, re-runs correctly, and deletes cleanly; the
same-page search submit is instant with zero network requests, matching
phase 4. For the Leaflet fix specifically: marker count changes
correctly through a full filter cycle (6 → 2 → 6, confirmed by
counting `.leaflet-marker-icon` elements) with zero page errors on
localhost, and the exact production-crashing interaction sequence
re-run against `https://soit.vercel.app` came back completely clean —
confirming the race is gone, not just harder to hit. Fixtures cleaned
up on both environments after every run.

This closes all 14 items from the original real-usage QA round, plus
the mid-batch rail restyle. Per the spec, steps 1-7 being done means
there's a working two-sided marketplace, loop closed, end to end. Next:
the rest of the real-usage QA backlog — bigger initiatives (pricing/
billing tied to AI-feature upgrade plans, and employer analytics, both
explicitly deferred to post-MVP), connecting a real email sender +
scheduled-job infra so saved-search notifications can actually be sent,
and step 9 (SEO check + compliance + polish: Search Console, real
privacy/terms content, consent, the §6.6 retention purge job, error
monitoring, and the map tile provider's licensing gap, explicitly
deferred earlier in this same round), with map/visual design polish
deliberately last, per your own instruction.

**Renamed from SóIT to Just IT (2026-09-28).** Came up while scoping
the email-provider work above — connecting a real sender needs a real
domain to verify (SPF/DKIM), which raised the question of what that
domain (and the brand) should actually be. "SóIT" leans on a
Portuguese-only pun (*Só* = only) that's completely invisible to an
English reader — a real problem for a product that's explicitly
bilingual from day one (§2.2), not a nice-to-have detail. "Just IT"
reads directly as "only IT" in English, still reads naturally to a
Portuguese audience (English loanwords are unremarkable in PT tech/
business naming — plenty of real Portuguese startups use them), drops
the diacritic (cleaner for a domain and email identity than an
accented name that punycodes to `xn--sit-zma.pt` in certificates and
every copied link), and matches the domain being bought: `justit.pt`.

Updated every user-visible occurrence: `brand.name` (the one i18n key
every wordmark in the app already reads dynamically — `TopNav`, the
`(auth)`/`(legal)`/`(preview)` headers, and the root layout's `<title>`
template all picked up the new name with zero other code changes,
confirming the earlier design choice to route every wordmark through
this single key rather than hardcoding it anywhere was worth it), the
footer copyright line, the external-apply-URL hint, the NIF-
verification "not a business" error copy, the team-invite email
subject, both application-flow email templates' sign-offs (`src/lib/
email/templates/*.ts` — plain strings, not i18n-routed, so these needed
their own direct edits), and the two job-browse pages' hardcoded
`<title>` tags (also plain strings, same reason). A couple of internal
doc comments (`globals.css`, `vies.ts`) were updated too, for
consistency — not user-facing, just kept accurate for anyone reading
the code later. `docs/mvp-build-spec.md` (the source of truth) got the
same treatment plus a proper rewrite of its own naming-convention
section, since that section specifically explained the *old* pun and
tied the ASCII form to "the domain" in a way that's no longer accurate.

**Deliberately not renamed**, and documented as a conscious choice
rather than an oversight: the npm package name (`package.json`'s
`"name": "soit"`), the GitHub repository/directory, and every
`soit`-prefixed internal identifier already in the codebase — the
Rail's `soit:rail-collapsed` localStorage key and
`soit:rail-collapsed-change` custom event, and the URL-params
mechanism's `soit:search-params-change` event (`src/hooks/
useUrlSearchParams.ts`). These are all purely internal, invisible to
any real user — renaming them would only add risk (e.g. silently
resetting an existing tester's saved rail-collapsed preference, since a
renamed key wouldn't match what's already in their browser's
localStorage) for zero user-facing benefit. Also left alone: the
working directory name and the actual GitHub repo (`PABCon/soit`) —
renaming either is a real operational/hosting decision with
consequences well beyond a code edit (breaks the terminal paths this
whole session has been navigating via, git remotes, any existing
deploy hooks), and wasn't asked for.

Verified live on both localhost and `https://soit.vercel.app`: page
`<title>` reads "… · Just IT", the nav wordmark renders "Just IT", the
footer copyright reads "© 2026 Just IT", and a full-page text search
for the old name after the change comes back empty on both. The
`NEXT_PUBLIC_SITE_URL` env var and the actual Vercel domain are still
pointing at `soit.vercel.app` — updating those to `justit.pt` is a
follow-up step once the domain purchase (in progress, your own doing,
outside anything I can do directly) actually clears and DNS is pointed
at Vercel.

**An 8-item real-usage UX pass** landed next, arriving as a single batch
after using the rebuilt landing page yourself. Two items needed a
clarifying decision up front, both resolved via AskUserQuestion before
any code: the icon approach for the new curated filter chips (you chose
simple-icons for real brand logos + lucide-react for generic category
glyphs), and exactly how "more filters" should behave (your own words:
"make it as a button, and then if the user clicks it shows as a left
side element and hides the map automatically, when closed the map pops
up again").

1. **Rail is no longer a layout-affecting sidebar in any state** — it
   was still a persistent `w-16` flex sibling when expanded (last
   session's collapse work only ever shrank it, never removed it from
   the flex row). `Rail.tsx` is now purely a `fixed`-positioned trigger
   button; clicking it opens a compact, content-sized popover flyout
   near itself (not full page height), which always starts closed on
   every page load — no persisted state at all anymore, so the
   `soit:rail-collapsed` localStorage key and its custom event are gone.
   `(candidate)/layout.tsx` dropped the flex-row wrapper this made
   unnecessary, and the shared content container (`TopNav`, `<main>`,
   `Footer`) widened from `max-w-6xl` (1152px) to `max-w-[1600px]`,
   directly answering your measured "~279px" margin complaint — that
   margin was Rail's old permanent width plus its own gutter.
2. **Dropdowns now dismiss on an outside click or Escape** — the
   original `<details>/<summary>` pattern (`LoginMenu`, `LanguageSwitcher`)
   never did either natively. New `src/hooks/useClickOutside.ts` +
   `src/components/Dropdown.tsx` (a controlled trigger/panel component,
   children as a render-prop receiving `close()` so menu items can
   dismiss themselves on click) replace `<details>` in both. Rail's own
   new flyout uses the same hook directly rather than going through
   `Dropdown`, since it's a single trigger button, not a menu list.
3. **Map close/reopen redesigned to your exact spec**: a small circular
   cross (×) button now sits in the map's own top-left corner (was a
   plain text "Ocultar mapa" button in the controls row); reopening it
   is a floating tab on the right edge of the viewport, deliberately
   mirroring Rail's own left-edge trigger tab, both in position and in
   the vertical-text treatment.
4. **Save-search discoverability** — the bookmark icon had no visible
   label, just a bare `title` tooltip carrying the same short "Save
   search" text as its own `sr-only` label, which is exactly what made
   it easy to miss and its purpose unclear on first encounter. Now shows
   a visible text label beside the icon (hidden only below `lg`, for
   width), and the hover tooltip is a new, more explicit
   `saveSearchHint` string that also says up front there's no
   notification delivery yet, rather than let a saved search's silence
   afterward read as broken. On success, the icon becomes a "Guardada"/
   "Saved" link straight to `/saved-searches` instead of just staying
   visually filled in.
5. **Curated filter row rebuilt as circular icon chips** — was a
   horizontally-scrolling row of text pills (your own words: "crazy
   list that u have to scroll"). New `src/components/icons/tech-icons.tsx`
   and `category-icons.tsx`: real brand-logo SVG path/hex data for 15 of
   the 20 featured tech tags, extracted once from the `simple-icons` npm
   package (v16.33.0) at build time and then **deliberately uninstalled**
   — it's ~3000 icons in one bundle and was never meant to be a runtime
   dependency, just a one-time data source; confirmed via direct
   slug/title search that Java, C#, AWS, and Azure genuinely have no
   entry in that package at all (not a lookup miss), so those plus the
   generic "sql" tag fall back to a small text badge instead of an
   invented logo. `lucide-react` (a real runtime dependency this time,
   confirmed via a direct tree-shaking import test) supplies 14 generic
   glyphs for the job categories, which aren't brands and don't have
   logos. The chip row now wraps onto as many lines as it needs and
   never scrolls.
6. **Favorite button added to the job detail page** — `FavoriteButton`
   already existed from an earlier phase but was feed-rows only; the
   job detail page fetches `getMyFavoriteJobIds()` alongside the
   existing apply-status call and renders the same component next to
   the title, hidden entirely for a non-candidate viewer (same
   `favoriteJobIds !== null` convention `JobRow` already uses).
7. **Removed the "Only IT jobs. Always with a salary." tagline** from
   the `/jobs` page header — flagged as useless clutter. The underlying
   `brand.tagline` i18n key itself was left alone, since it still does
   real work elsewhere (page meta description).
8. **Controls row reorganized**: sort, the remote-only toggle, and the
   result count now share one row directly above the list (were split
   across two rows with the count and a separate "Limpar filtros" line
   below). The remote toggle is a new `src/components/Switch.tsx` — a
   plain Tailwind `peer`-modifier pill switch, no new dependency —
   replacing the native checkbox you called "ugly." "More filters" is
   now a toggle button that opens a genuine left-side panel (was an
   inline panel pushing content down) and, per your explicit answer
   above, automatically hides the map while open and restores it when
   closed, rather than the two fighting for the same screen space.

**A real bug was caught by this batch's own verification, before it
ever reached you**: the map's new cross-close button was styled with
`z-500` — not a valid Tailwind utility (its default scale has no `500`
step), so the class silently generated no CSS at all, leaving the
button at the page's default stacking order. Leaflet's own zoom control
defaults to that exact same top-left corner with a real `z-index: 1000`
from its own stylesheet, so the button was visually present but
physically unclickable — every click landed on Leaflet's "+" control
instead, confirmed via Playwright's own pointer-interception trace, not
a guess. Fixed two ways together: the class corrected to `z-[1100]`
(bracket syntax for an arbitrary value, safely above Leaflet's 1000),
and — since simply raising z-index would have left two controls
visually stacked on each other in the same corner — Leaflet's zoom
control moved to `bottomright` via `zoomControl: false` at map creation
plus a manually added `L.control.zoom({ position: "bottomright" })`
(`JobMap.tsx`), so the two no longer physically overlap either.

Verified live on both localhost and `https://soit.vercel.app` with
fresh fixtures (a remote React job, an office Python job in Porto, and
a hybrid job in Lisboa, plus a confirmed candidate account), all eight
items checked by a real Playwright run against each environment: the
tagline is gone; the circular chip row has no page-level horizontal
scroll and a React chip correctly narrows the list; Rail's flyout stays
closed by default, opens on click at a compact height, and closes on
an outside click; the result count, sort, and the new Switch remote
toggle share one row and the toggle filters correctly; "More filters"
opens a left-side panel and hides the map, and closing it restores the
map; the map's cross button closes it, a right-edge tab reappears and
reopens it; no dropdown (avatar menu, language switcher) stays open
after a click elsewhere; the save-search button carries the clearer
hover hint and a visible label, with no notification claim anywhere on
the bar; a candidate's favorite toggle on the job detail page works and
the job then appears on `/favorites`, while an anonymous visitor sees
no favorite button there at all. Zero console errors on either
environment across every run. All fixtures (companies, jobs,
employer/candidate accounts) cleaned up on both afterward, including
three extra orphaned companies left behind by earlier failed fixture-
setup attempts during this same session (wrong FK columns while writing
the seed script itself, not an application bug) — swept up in the same
cleanup pass rather than left behind.

**An 11-item employer-console review came in next.** Planned formally
(3 parallel Explore agents, then a written 7-phase plan) since it's the
largest batch yet — new tables, new pages, and a first AI/LLM
integration. Two items are explicitly **not** implementation work and
excluded from the plan entirely, per your own words: item 6 (pricing —
you want real business modeling and a LinkedIn comparison, not just
porting justjoin.it's numbers, so that's a conversation to have next,
not code to write) and item 7 (contact chat/email — "later... I still
need to think about it with you"). Item 10 (job-posting redesign) got
scoped down to its pricing-independent parts (link-paste autofill,
must-have-tech-with-level, working-language-with-level, a cosmetic
days-left bar) — banner/video upload and anything pricing-tier-gated
stays out until item 6 is actually resolved. One real architecture
decision got confirmed with you via AskUserQuestion before planning:
the link-paste autofill will use LLM-based extraction (Vercel AI
Gateway) rather than parsing `JobPosting` schema.org markup — your own
call, since the future candidate-scoring engine (item 4) needs that
same investment anyway. Full 7-phase plan retained at
`~/.claude/plans/refactored-zooming-wren.md` for the remaining phases.

**Phase 1 shipped**: items 1 and 3. The employer console had no top
navbar at all — no avatar, no language switcher up top, unlike the
candidate site's own `TopNav`. New `ConsoleTopNav` (server) +
`AccountMenu` (client) mirror the candidate `TopNav`/`LoginMenu`
pattern exactly — same shared `Dropdown`/`LanguageSwitcher` components,
no new mechanism — but deliberately slimmer: the console `Sidebar` is
always visible (not hidden below `sm` the way the candidate `Rail` is),
so `AccountMenu`'s panel only needs My Account + Log out, not a full
mobile-fallback nav duplicating every Sidebar link. `fullName`/
`avatarUrl` are read once, server-side, in `(console)/recruit/
layout.tsx` (which already fetches the session for its own auth guard)
and passed down as props — no second client-side auth fetch/loading
flicker. `Sidebar.tsx` drops its own now-redundant wordmark and bottom
logout/language row. Item 3: the per-job Applicants page had no way
back to the job list — added, same `text-sm font-medium text-pine
hover:underline` idiom the job-edit page's own forward link to
Applicants already used.

Verified live on both localhost and `https://soit.vercel.app` with a
fresh verified-employer-plus-job fixture: the top bar renders with a
working language switcher and an avatar dropdown showing the
employer's name, a My Account link, and Log out; the dropdown closes on
an outside click; the Sidebar no longer shows a duplicate wordmark; the
Applicants page's back link is present and, confirmed via a direct
network-logged reproduction on both environments, does correctly
navigate back to `/recruit` (an initial automated run *looked* like the
click silently failed to navigate on both localhost and production —
re-run immediately after with request/response logging attached showed
a completely clean navigation both times, confirming it's the same
intermittent Playwright-vs-Next-client-hydration timing flakiness
already seen and dismissed once earlier this session for an unrelated
link, not a real app bug). Zero console errors either environment.
Fixtures cleaned up on both afterward.

**Phase 2 shipped**: item 8, team invites. A pending invite could be
created but never inspected, resent, or deleted afterward.
`employer_invites`' RLS already grants owners `for all` on their own
company's rows (confirmed by reading the migration, not assumed) — so
`deleteInvite()`/`resendInvite()` (`src/lib/db/team.ts`) are plain
RLS-scoped calls, no migration needed. `resendInvite()` **updates** the
existing row's token + expiry in place rather than inserting a second
row — `employer_invites` has a `unique(company_id, email)` constraint a
naive re-invite would conflict with. Each pending-invite row in
`TeamManager.tsx` now shows an "expires in N days"/"Expired" readout
(computed from data already fetched, no new query), a Revoke button,
and a Resend button that re-surfaces a fresh copyable link — keyed per
invite id (`resentLinks`/`copiedInviteId`) so more than one row's
link/copy-feedback state can't collide, unlike the single global
`lastLink` slot the create-invite flow already used and kept unchanged.

Verified live on both localhost and `https://soit.vercel.app` with a
fresh verified-employer fixture: creating an invite shows the correct
7-day expiry readout; Resend produces a genuinely new link (confirmed
by reading it back, not just checking a success flag) without touching
the row's email/role; Revoke removes the row. Two things worth noting
from this round's own verification, neither a real bug: a clipboard
`writeText` permission error appears in the browser console under
Playwright's default headless context (confirmed pre-existing —
reproduced the exact same error against the *original*, untouched
create-invite copy flow too; granting `clipboard-write` permission
explicitly in the test context made it disappear entirely, and the
UI's own "Copied!" feedback was correct either way since the code never
awaits the clipboard promise); and the first production verification
pass used a 700ms wait that was too short for a real network round
trip and read as failures across the board — a second pass with 2s
waits and full diagnostic output (same "production is slower than a
same-machine dev server" pattern already documented several times
elsewhere in this file) showed everything working correctly. Fixtures
cleaned up on both afterward.

**Phase 3 shipped**: item 9, the employer's own "My account" page had
nothing but name and password. `phone` now lives in
`user_metadata` alongside `full_name`/`avatar_url` (same place
`last_role`/`pending_nif` already do — no new column, mirrors the
candidate profile's own phone field). `email` is shown but **read-only**
— the real Supabase Auth login email, displayed with the exact same
disabled-input styling `CandidateProfileForm` already uses for its own
email field, since changing a login email is a separate, riskier flow
that wasn't asked for here.

Verified live on both localhost and `https://soit.vercel.app` with a
fresh verified-employer fixture: the email field shows the correct
login email and is genuinely disabled; setting a phone number, saving,
and reloading the page confirms it persisted. Zero console errors
either environment. Fixtures cleaned up on both afterward.

**Phase 4 shipped**: items 2 and 4, the biggest phase so far. Applicants
were only ever reachable per-job. New `getAllApplicantsForCompany()`
(`src/lib/db/applications.ts`) reuses `getApplicantsForJob`'s exact
shape — the same RLS-scoped `applications` read plus admin-client
candidate lookup (`candidates` deliberately has no employer-read RLS
policy) — just filtered by the embedded job's `company_id` instead of
a single `job_id`, using the same "force `!inner` + dot-notation
filter" trick `getBrowseJobs()` already established for restricting
parent rows by an embedded resource's column. New `/recruit/applicants`
page + Sidebar entry list every applicant across every job, each
showing which job it's for.

New canonical `/recruit/applicants/[id]` detail page — one route,
reachable from both the per-job and the aggregated lists, rather than
building two separate detail views. Shows the candidate's photo/name,
contact info (phone, LinkedIn, email — the same fields the candidate's
own profile form exposes, now also selected into `Applicant`/
`CompanyApplicant`/`ApplicantDetail`, previously just name+email),
skills, cover note, CV, and the same status control the list rows
already have. Opening it calls the existing `updateApplicationStatus`
directly from the server component (no need to route through a client
action) to mark it "viewed" — but **only** when the current status is
exactly `'applied'`, so reopening a candidate an employer already
progressed to `responded`/`rejected`/`closed` never silently bumps them
back to `'viewed'`.

Verified live on both localhost and `https://soit.vercel.app` with a
fresh fixture (one employer, two jobs, one candidate — full profile:
phone, LinkedIn, skills — applied to both, a real PDF CV attached to
each): the aggregated list shows both applications with correct job
context per row; the detail page shows every field correctly; opening
a fresh `'applied'` application auto-advances it to `'viewed'` and
stays `'viewed'` on a second visit; manually setting the other
application to `'responded'` first and then opening its detail page
confirms it stays `'responded'`, not reset to `'viewed'` — the exact
regression this design was meant to prevent, checked directly rather
than assumed; the per-job list's candidate-name link and the
aggregated list's own link both land on the same canonical detail
route. Zero console errors either environment. Fixtures (including the
uploaded CV storage objects, which row deletion doesn't cascade-remove)
cleaned up on both afterward.

**Phase 5 shipped**: item 5, company address + a public-profile map.
New migration (`20260928190000_companies_location.sql`, applied via
`supabase db push` against the live project): `companies.location_id`
(FK to the existing curated `locations` table) + a free-text
`companies.address`. Reuses the exact reasoning that already moved
`jobs.location` off free text: the map pin sits at the chosen city's
centroid — no geocoding provider, zero new cost — and the address is
just a human-readable line shown beside it, not itself geocoded.
`CompanyProfileForm` gained a location `<select>` (same
`LocationOption[]` prop shape `JobForm` already takes) + an address
input. The public `CompanyProfileBody` (shared by the canonical
`/companies/[slug]` page and the console's noindex preview route) now
renders a new "Our office" section between the stat cards and "Open
jobs," omitted entirely when no location is set — same convention
every other optional section on that page already follows.

New `src/components/CompanyMap.tsx` adapts `JobMap.tsx`'s
mount-effect/markers-effect split even for a single static point,
deliberately — that split exists specifically to guard against the
real production Leaflet crash `JobMap` itself was once fixed for
(recreating the whole map instance on every re-render), and there was
no reason to risk the same class of bug for a "simpler" one-off
version. Also hit, and had to route around, a Next 16 constraint: `next/
dynamic`'s `ssr: false` is no longer allowed from a Server Component's
own module scope (`CompanyProfileBody` has no `"use client"`) — fixed
by importing `CompanyMap` directly instead of wrapping it in `dynamic()`,
since it's already a client component with no SSR-unsafe top-level code
(leaflet is only touched inside a `useEffect`).

**A real bug was caught by this phase's own verification**: the map
initially used Leaflet's default `L.marker()` icon, which 404'd on
`marker-icon.png`/`marker-shadow.png` — confirmed directly via a
network-logged reproduction, not guessed — because those default
image paths resolve relative to the *current page URL* under
Turbopack/webpack bundling, not Leaflet's own asset path. Fixed with a
custom `divIcon` (a small solid circle, no external image), the exact
same approach `JobMap.tsx` already uses for its own pins for the same
underlying reason — this codebase should never reach for Leaflet's
default marker icon again.

Verified live on both localhost and `https://soit.vercel.app` with a
fresh verified-employer fixture: before setting a location, a fresh
company's public page has no "Our office" section at all; setting
Lisboa + a street address in the console and saving persists
correctly; the public page then shows the address line, a rendered
Leaflet map, and a visible marker, with zero console errors — including
zero 404s, re-checked explicitly after the icon fix on both
environments. Fixtures cleaned up on both afterward.

**Phase 6 shipped**: items 10b/10c and 11 — the last real feature phase
before item 10a's LLM autofill. Its actual purpose, per your own
framing: give the future candidate-scoring engine (item 4) a
structured, job-side vocabulary to score against later — this phase
builds none of the scoring itself.

Must-have tech + level **extends the existing `job_tech_tags`
relationship in place** (new `level`/`required` columns) rather than a
new free-text requirements table — a direct match for the reference
screenshot's own "TECH STACK: SQL — Advanced" display, and it reuses
`JobForm`'s existing tech-tag picker UI instead of building a parallel
one. Working languages are a genuinely new, separate concept from
`jobs.language` (which is just "what language is this ad written in,"
unrelated to any skill) — a new curated `spoken_languages` table
(English/Portuguese/Spanish/French/German, same shape as `locations`/
`job_categories`) and a `job_languages` join table (same shape as
`job_tech_tags`). Both migrations applied to the live Supabase project
via `supabase db push`.

`JobForm.tsx`'s tech-tag selection model changed from a flat
`string[]` to `{id, level, required}[]` — each selected chip now shows
an inline level `<select>` and a "Must-have" checkbox, defaulting to
required=true/level=unset on first pick. A new "Required languages"
section mirrors the same shape for the small curated language list
(checkbox + level, no filter-by-typing needed for only 5 entries).
`saveJob` extends its existing delete-then-reinsert pattern for
`job_tech_tags` to carry the two new columns, and adds the identical
step for `job_languages`. `getJobForEdit`/the shared `SELECT` grew to
read both back for pre-fill and public display respectively.

The candidate-facing job detail page now shows required languages
(`jobForm.requiredLanguages`, reusing the console form's own i18n
keys rather than duplicating them) — without this, the data an
employer enters would be entirely invisible to candidates, defeating
the point of collecting it. New `JobExpiryBar` — a slim gradient
progress bar matching the reference screenshot, next to the existing
"N days left" badge logic.

**A real lint catch, not a runtime bug, worth remembering**: `JobExpiryBar`
originally called `Date.now()` directly inside its own render body —
React's purity rule (`react-hooks/purity`) correctly flags this as an
impure call a component must not make directly, since a component's
job is to be idempotent for the same input. Fixed by pulling the
calculation out into a plain `expiryPercentLeft()` helper (not a
component, so the rule doesn't apply) that the *page* — a genuinely
per-request server compute, not a re-rendering component — calls once
and passes down as a plain `percentLeft` prop; `JobExpiryBar` itself is
now purely presentational.

Verified live on both localhost and `https://soit.vercel.app`,
end-to-end through the **real `JobForm` UI** (not seeded directly, to
actually exercise the new picker controls): posted a job picking React
(Advanced, must-have) and TypeScript (no level, nice-to-have) as tech
tags, and English (Advanced) plus French (no level) as required
languages — confirmed by reading the database directly afterward that
`job_tech_tags`/`job_languages` hold exactly those values, not just
that the form appeared to accept them; the public job detail page
shows "Idiomas necessários" with "English — Avançado" and a bare
"French," plus a rendered expiry bar and days-left caption; reopening
the job's edit page correctly pre-fills React/TypeScript with their
exact level/required state and English/French as checked (Portuguese,
never selected, correctly unchecked) — a genuine round trip, not just
a one-way save. Zero console errors on either environment across every
step. Fixtures cleaned up on both afterward.

**Phase 7 shipped — the last phase of the employer-console review**:
item 10a, "paste a link to an existing job posting and auto-fill the
form." This was the batch's first-ever AI/LLM integration
(genuinely greenfield — nothing in this codebase touched an LLM
before), routed through **Vercel AI Gateway** rather than a direct
provider SDK, model Claude (`anthropic/claude-sonnet-5.5`), per your
own explicit call after weighing it against a direct Anthropic API key
— same model either way, but Gateway means one account/one bill
(the existing Vercel account) instead of a second one to manage.
Followed this project's `ai-sdk` skill throughout rather than trusting
prior knowledge of the SDK — its own first line warns "everything you
know about the AI SDK is outdated or wrong," and it was right:
`generateObject` turned out to be **deprecated** in the installed SDK
version (`ai@7.0.122`); the current API is `generateText` with an
`output: Output.object({ schema })` option. Also fetched the live
model list from the Gateway's own `/v1/models` endpoint rather than
using a remembered model id, per the skill's explicit instruction —
caught nothing wrong this time, but it's exactly the kind of check
that would.

**Getting the Gateway connection live needed two real, sequential
account-side steps, neither of which I could do myself** — a first
`generateText` call came back "AI Gateway requires a valid credit card
on file"; after you added one, the *next* call came back "Free tier
users do not have access to this model" — the account needed an
actual credits top-up, not just a card, before any model access
unlocked. Both are genuine Vercel-dashboard steps outside anything a
CLI/API can do; you completed both live in this same session, and a
`generateText` call succeeded that same session, purely by re-running
the plain sanity check rather than reasoning about it.

`src/lib/ai/extract-job.ts` fetches the target page server-side (10s
timeout, 2MB cap on the response — a real posting page is a few
hundred KB at most; this is a hard backstop, not a tuned limit),
strips it to plain text with a blunt tag-strip (no readability
library — good enough for an LLM prompt, not a human reading view),
and asks the model to fill only fields it's genuinely confident about:
every field in the zod schema is nullable, and the prompt explicitly
tells it never to invent salary numbers, tech, or languages that
aren't actually in the text. Deliberately returns no location/category
at all — an external posting's location text won't map cleanly onto
the 14 curated Portuguese cities, and category is a judgment call left
to the employer, matching the plan's own framing of "leaving other
essential fields." Tech-tag and required-language labels come back as
plain strings and are fuzzy-matched **client-side**, in `JobForm.tsx`,
against the real `techTags`/`spokenLanguages` vocab already available
there as props — a label with no real match is silently dropped, never
invented as new vocabulary. New "paste a job link" section sits at the
top of `JobForm.tsx`, **create mode only** — autofilling over an
employer's own in-progress edit would be destructive — and
`applyExtractedData()` only ever *sets* a field the model actually
returned; a field it left null is left completely untouched, never
blanked.

Verified with a genuine, real end-to-end run on both localhost and
`https://soit.vercel.app` — not a mocked LLM response: created a real
source job (rich description, React/Node.js tags, a 3500-4500 EUR
salary, hybrid/senior/permanent, English required) on each environment
first, then, from a **separate** fresh employer account's real
`/recruit/jobs/new` page, pasted that source job's own live public URL
and clicked "Fetch & fill." The actual Gateway call correctly
extracted title, description, seniority, work model, salary range, and
employment type; correctly fuzzy-matched React and Node.js as selected
tech tags and English as a required language; and correctly left
location/category untouched — confirming both the real extraction
quality and the "never touch these two fields" rule at once. Zero
console errors on either environment. This closes all 11 items of the
employer-console review (items 6 and 7 remain explicitly deferred —
pricing needs a real business-model conversation, and item 7's contact
channel needs more of your own thinking first, per your own words at
the start of this round). Fixtures cleaned up on both afterward.
