# SóIT — Spec Batch

**Version:** v1.7
**Date:** 2026-09-18
**Status:** MVP spec complete and review-hardened — **build started**. Domain (`soit.pt`) still to confirm and register.

Reference model: justjoin.it (candidate site) + rocketjobs.com (employer console). Core differentiators: **mandatory salary ranges** and **verified employers** (NIF-validated business entities).

---

## Files in this batch

| File | What it is |
|------|-----------|
| `mvp-build-spec.md` | The master blueprint. Architecture, tech stack, SEO, data model, security & RLS, navigation, map, auth, flow diagrams, design direction, extension plan, build sequence, open risks. Hand this to Claude Code. |
| `flows/flow-a-core-loop.mmd` | The core marketplace loop (post → apply → status). |
| `flows/flow-b-apply-account.mmd` | Apply → account creation with verified claiming (the growth loop). |
| `flows/flow-c-employer-post.mmd` | Employer posts a job (inside the employer console). |
| `flows/flow-d-auth.mmd` | Authentication with the role-split entry point + Add offer shortcut. |
| `flows/flow-e-status-lifecycle.mmd` | Application status lifecycle. |
| `flows/flow-f-navigation.mmd` | Navigation: two separate surfaces (candidate site + employer console). |
| `flows/flow-g-employer-verification.mmd` | Employer NIF verification: checksum → prefix → VIES → fallback → manual review. |

All `.mmd` files are Mermaid, importable into Miro (paste into Creation bar → Diagram → Build with code). See §10 of the spec. **The `.mmd` files are the source of truth; the copies embedded in §10 are kept byte-identical to them — edit both or neither.**

---

## What's decided so far

- **Name: SóIT** — *só* is Portuguese for *only*. Brand keeps the accent everywhere a person sees it; all machine-readable identifiers (package, repo, directory, Vercel project, domain) use the ASCII form **`soit`**.
- **IT-first**, transparency-first job board for Portugal; horizontal expansion is a later option.
- **Salary is mandatory and unambiguous** on every listing: min, max, **period**, and **employment type**. EUR primary, gross, with a 12-vs-14-month flag.
- **Employers are verified business entities.** Registration requires a Portuguese **NIF/NIPC**, validated **automatically** — offline checksum + entity-type prefix inline, then an async VIES lookup. **No admin step, no human queue.** The gate is at publish, not signup.
- **Two surfaces, one database:** a public candidate job site (justjoin.it-style) and a separate employer console (rocketjobs.com-style). Employers never land in the candidate feed. Built as **one Next.js app with two route groups**, not two apps.
- **Full two-sided MVP:** employers self-serve post; candidates browse, apply, and track.
- **Companies have teams.** `companies` + `employer_users` + `employer_invites`: multiple recruiters per company, `owner` / `member` roles, and verification attached to the **company** so an invited recruiter inherits it.
- **Published jobs are editable**, salary included — with every salary change written to the event log.
- **Company page is in the MVP** — public company profile page (SEO + branding asset) + Company Profile editor in the console.
- **Posting is free in the MVP**; monetisation designed for but deferred.
- **Candidate accounts** in the MVP (apply creates the profile; tracking is the login hook). Profiles are **claimable only after email verification**.
- **Bilingual from day one:** PT + EN on a `.pt` domain, both locale-prefixed (`/pt/…`, `/en/…`) via `next-intl`. UI chrome is translated; job ads stay in whatever language the employer wrote, recorded in `jobs.language`.
- **Stack:** Next.js + Supabase + Tailwind + Vercel. Candidate surface server-rendered and crawlable (Google for Jobs).
- **Auth:** email/password + social (Google, LinkedIn, GitHub, Facebook); role chosen at entry point, routes to the right surface. A person may hold **both** profiles.
- **Security is a build-step-2 deliverable:** RLS on every table, private CV bucket with signed URLs, GDPR baseline.
- **Map view** included (coordinates captured from day one, view built after the loop closes).

## Explicitly deferred (documented, not built)

Product communication/notification layer (touchpoints marked in the flows — **auth transactional email ships, it is not the comms layer**), payments/monetisation (console My products/Pricing), employer Matchmaking + candidate Recommendations, response rates, ghosting penalties, tech-stack proficiency levels, AI/CV tools, company reviews, native app, self-serve GDPR export/erasure, and later candidate rail items.

---

## Changelog

- **v1.7 (2026-09-18)** — **Product name locked: SóIT.** All `[Product Name]` placeholders resolved; naming convention recorded in §1 (accented brand for humans, ASCII `soit` for machines — npm forbids accented package names and an IDN punycodes to `xn--sit-zma.pt` in certificates, analytics and copied links). Spec moved into the project repo at `docs/`. Remaining open item for step 1 is the **domain**.
- **v1.6 (2026-09-18)** — Language settled, NIF simplified. **Spec is build-ready.**
  - **Bilingual PT + EN from day one (new §2.2)** on a `.pt` domain. Both locales explicitly prefixed (`/pt/jobs/[slug]`, `/en/jobs/[slug]`), `/` redirecting on `Accept-Language` with `pt` as default; `next-intl`; `hreflang` pairs plus `x-default`, per-locale sitemap entries and JSON-LD on both locale URLs (§4). i18n is wired in **build step 1**, before any page exists — hard-coded strings swept up later are how bilingual builds rot.
  - **Ad content is not translated.** `jobs.language` (§5.2) records what the employer wrote so the feed can badge and filter it; a Portuguese ad stays Portuguese on the English site, correctly labelled.
  - **NIF verification is now fully automatic (§5.7.3, §5.7.6).** The `ViesProvider` integration ships in the MVP rather than being stubbed. `manual_review` is gone from the enum, and **there is no admin surface in the product at all** — the whole `(admin)` route group, the review queue and the env allowlist are removed, and build step 4 goes back to being just the employer console.
  - **Prefix rules simplified accordingly (§5.7.2)** — business entities (`5`, `6`, `71`, `72`) accepted, natural persons rejected. This excludes sole traders by design; widening it later is a pure-function change.
  - **Two edges documented rather than designed around:** a domestic-only Portuguese company can return `not_found` from VIES and lands in `failed` with a support route (the fix, if it is more than a trickle, is layer 3 — not a human queue); and an unreachable provider leaves a company `pending`, never auto-passing and never failing on a timeout.
  - GDPR erasure and `tech_tags` maintenance run from the Supabase dashboard (§6.6, §13).
- **v1.5 (2026-09-18)** — Four decisions taken; three implemented, one still open.
  - **Multiple users per company — built (§5.1).** `employers` is split into **`companies`** (the business, and the owner of the NIF and verification state) and **`employer_users`** (a person's membership, `owner` | `member`), plus **`employer_invites`**. `jobs.employer_id` → `jobs.company_id` with `created_by` retained for display. Registering against an already-registered NIF no longer creates a duplicate — it tells the user to ask an owner for an invite, without revealing who they are.
    - RLS reworked around a single `my_company_id()` SQL function (§6.2), so every employer-scoped policy shares one membership rule — which is also what makes allowing multi-company membership later a one-function change.
    - **Verification now belongs to the company**, so an invited recruiter at a verified company publishes immediately rather than re-verifying. This is a better model than v1.4's, which had put the NIF on the same table as the login.
    - Scope note: the **schema split is what had to happen now**; the **invite UI** (§7.2 Team) is ordinary console work and may slip a phase without any migration cost.
  - **Published jobs are editable — decided and specified (§5.2, §7.2).** Salary included, with three consequences built rather than debated: every salary change writes a **`job.salary_changed`** event (old and new values), editing a live ad refreshes its JSON-LD and re-requests indexing, and editing an expired or inactive ad never silently republishes it. Added `jobs.updated_at`.
  - **Admin surface scoped down (§14 step 4).** Cut to **one screen** — the verification queue — behind an env allowlist of admin emails, not a role system. GDPR erasure and `tech_tags` maintenance run from the Supabase dashboard until the volume justifies a UI. The queue is the exception only because it sits in the critical path of every signup.
  - **New §15.0 Settled** — decisions now have a recorded home, so the spec stops re-litigating them.
  - **Still open: site language.** The one remaining step-1 blocker alongside product name and domain.
- **v1.4 (2026-09-18)** — NIF registry integration **deferred to a placeholder**; new decisions surfaced before build start.
  - **§5.7.6 MVP placeholder.** Layer 1 (mod-11 checksum + prefix rules) ships in full, along with the **complete state machine, publish gate and admin queue**. Layers 2–3 sit behind a `NifRegistryProvider` interface bound to `ManualOnlyProvider`, gated by `NIF_REMOTE_VERIFICATION` (default off). Landing VIES later is one module plus a flag — **no schema, flow or UI change**. The §1 rule is unchanged; verification is simply manual.
  - **Consequence stated plainly:** manual review becomes the path *every* employer takes, so nothing reaches `verified` — and no job publishes — without a human. Fine at launch volume; the trigger to build layer 2 is **~10–15 new employers/week**, a rate not a date.
  - **Admin surface promoted to a build prerequisite** (§14 step 4, §15.1). Three features already assumed an admin — the NIF queue, GDPR erasure, `tech_tags` management — and with the registry stubbed the queue is now load-bearing. Build it *before* the employer console.
  - **New §6.7 — the anonymous apply endpoint.** Account-free apply is an unauthenticated POST accepting file uploads from anyone: content-sniffed type allowlist, size cap at the edge, per-IP and per-email rate limits, bot challenge, server-side live-job check, and uploads never served from the app's own origin.
  - **New open decisions (§15.1)** — **site language(s)**, flagged as blocking step 1 and the most expensive to defer (it sets URL structure and `hreflang`; retrofitting a locale segment after step 5 discards accumulated SEO); whether a **published salary can be edited** (an integrity question for this product, not a CRUD detail); job description input format and HTML sanitisation; analytics tool; FK delete behaviour.
  - **§15.2** — the review queue needs a *named person* with a same-day expectation from launch, or the verification gate and the cold-start problem compound.
- **v1.3 (2026-09-18)** — **Employer identity verification (NIF)** added as the product's second hard rule (§1, §5.7).
  - **New §5.7** — three-layer validation, because no single source is sufficient: (1) offline **mod-11 checksum + entity-type prefix rules**, (2) **VIES** (free, and for Portugal returns the registered legal name), (3) a **commercial registry provider** as fallback. Includes the checksum algorithm, the prefix decision table, and the provider comparison.
  - **Two findings that shape the design.** VIES only knows entities registered for *intra-EU* operations, so a real domestic-only Portuguese company returns invalid — a negative VIES result therefore means **unconfirmed, never rejected**. And **there is no free public AT / Portal das Finanças API** for this (the public lookup is a captcha form; AT's web services are e-invoicing endpoints needing qualified certificates) — do not design around an AT integration.
  - **Verification is a state machine**, not a boolean: `unverified → pending → verified | manual_review | failed`. Layers 2–3 run **asynchronously**, never inline in signup; provider outages produce `pending` with backoff, never `failed`.
  - **The gate sits at publish, not at signup** (§5.7.4) — an unverified employer can register, fill the company profile and draft ads, but cannot go live. Keeps a third-party outage from blocking acquisition, and protects the asset that matters (the public listing).
  - **`employers` gained** `nif` (unique), `nif_country`, `verification_status`, `verified_legal_name`, `verified_at`, `verification_source`, `verification_reference`. RLS updated so `nif` and the verification columns are never publicly readable and are server-write only (§6.2).
  - **Sole traders flagged as an open decision** — in Portugal they legally trade under a personal NIF (prefix 1–3); rejecting them excludes real one-person consultancies, auto-accepting them is the easiest abuse path. Spec currently routes them to manual review.
  - **NIF added to the GDPR surface** (§6.6) — a sole trader's NIF is personal data, so it is never shown publicly by default and is included in retention and erasure.
  - **New Flow G** (`flow-g-employer-verification.mmd`); Flow C gained the publish gate and Flow D the NIF step. All seven `.mmd` files are now **generated from** the spec's embedded copies, so drift is structurally impossible.
  - **Raised as a consequence:** `nif` and `auth_user_id` are both unique on `employers`, so today **one company = one login** and a second recruiter cannot register. Splitting `employers` into `companies` + `employer_users` is now the top open decision (§15.1) — cheap at step 2, a migration later.
- **v1.2 (2026-09-18)** — Review pass; resolved four build blockers, five internal contradictions and two false cost assumptions.
  - **New §6 Security, access control & data protection** — RLS policy table for every table (v1.1 never mentioned RLS at all), private `cvs` bucket with short-lived signed URLs, and a **GDPR baseline** (lawful basis, controller split, 12-month retention, erasure route) for a product that stores CVs of people who never made an account.
  - **Role now has a source of truth** (§6.4) — Flow D routed on `{Role}` with nothing behind it. One auth user may hold one employer and one candidate profile; landing follows `last_role`, authorisation never does.
  - **Profile claiming is gated on email verification** (§6.5) — closes an exploit where applying with someone else's address let a stranger inherit their application history and CV.
  - **Auth transactional email carved out of the out-of-scope list** (§9.1) — v1.1 promised email/password "with verification" while §12 said nothing is ever sent, so no account could activate.
  - **Salary made unambiguous** (§5.2) — added required `salary_period` and `employment_type`, plus a 12/14-month flag and an explicit gross rule. Portugal quotes monthly gross over 14 months, and `unitText` was already a hard Google for Jobs requirement §4 depended on but §5 had no column for.
  - **`applications.status` gained `closed`** (Flow E terminated at a state the enum didn't have) and a `unique (job_id, candidate_id)` constraint.
  - **Tech stack normalised** to `tech_tags` + `job_tech_tags` (§5.6) — a `text[]` makes "React"/"ReactJS"/"react.js" three filter values, and fixing it later would be a migration, breaking §12.1's additive promise.
  - **Expiry given a mechanism** (§5.5) — no cron and no stored `expired` status; live is the computed condition `published AND expires_at > now()`. Console tabs redefined (§7.2) so expired and closed ads stop being hidden from their own author. Slug collision strategy defined.
  - **Deployment ambiguity resolved** (§2.1) — "two surfaces" is routing, not two apps: one Next.js app, route groups `(candidate)` and `(console)` at `/recruit`.
  - **Map costs corrected** (§8.1) — v1.1's "Cost €0 with OpenStreetMap" named no provider; OSM's community endpoints forbid commercial use. Tiles and geocoding providers now named with their real limits.
  - **Design tokens moved to build step 1** (§14) — applying §11 at step 9 meant building every component twice. Added a shared salary component, a `--mint` contrast warning, and the explicit `tabular-nums` setting.
  - **New §15 Open decisions & known risks** — including the **cold-start supply problem**: the spec specifies the loop but never said where the first 50 job ads come from.
  - **Flow files re-synced** — `flow-a` still said "dashboard" after the v1.1 console rename; flows B, C, D and F updated for verified claiming, salary fields, expiry and dual-role landing. All six `.mmd` files now match their embedded copies byte-for-byte.
- **v1.1 (2026-09-18)** — Corrected the architecture to **two separate surfaces over one database**: a public candidate site and a dedicated employer console ("Manage recruitments"). Employers land in the console, not the candidate feed. **Added the company profile page to the MVP** (public page + console editor). Reworked navigation and Flow F accordingly; updated Flow C (post happens in the console) and Flow D routing.
- **v1.0 (2026-09-18)** — Consolidated MVP spec: justjoin.it reference, full two-sided scope, candidate accounts + apply→account loop, map view, social login, SEO/Google-for-Jobs architecture, six Miro-importable flow diagrams, app-shell navigation, role-split login entry point, design direction, extension plan.

## Next step

Confirm and register the **domain**, then build §14 step 1: skeleton + `next-intl` locale routing + two shells + design tokens. Line up the first ten employers in parallel — §15.2.
