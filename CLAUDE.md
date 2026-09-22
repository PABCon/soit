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

Next: the rest of the real-usage QA backlog — bug fixes (silent image-
upload error handling, delete-job button, job pause/deactivate control,
duplicate-draft UX, dual-role-signup fix, applicant-count-not-clickable);
core gaps (candidate profile page, password change, forgot-password, team
member profile fields); bigger initiatives (pricing/billing, Follow +
AI-generated profiles once the base product is done, job browse/category
pages, employer analytics, abandoned-application-recovery popup) — plus
step 9 (SEO check + compliance + polish: Search Console, privacy policy,
consent, the §6.6 retention purge job, error monitoring), with map/visual
design polish deliberately last, per your own instruction.
