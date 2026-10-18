# Go-live checklist

Everything flagged as "before launch" / "deferred" / "known gap" across
this project's build (see `CLAUDE.md` for the full history, and
`docs/mvp-build-spec.md` §14 step 9 / §15.1 for where several of these
were first called out), consolidated in one place so nothing gets
launched-past silently. Grounded against the live project's actual
current state (checked directly via the Supabase Management API and
Vercel, not assumed) — last updated 2026-10-01 — update this file as
items close, same as every other doc in this project.

Not a step-by-step build plan — these are independent, tick off in
whatever order makes sense.

**Re-audited 2026-10-17** against live Vercel/Supabase/Stripe state (not
memory/CLAUDE.md, which itself stops narrating new work after the
"Landing-page redesign, round 7" entry despite dozens of real commits
since). Everything below was re-checked directly except Supabase's
current Free/Pro plan and its Auth provider config, which this round's
tooling couldn't reach (Management-API token access was blocked) —
those two keep their prior status on the strength of there being no
commit or CLAUDE.md entry anywhere suggesting either changed.

## Domain & DNS

- [x] Register/confirm `justit.pt` — registered, DNS delegated to
      Vercel (`A justit.pt 76.76.21.21`, same for `www`)
- [x] Point DNS at Vercel; add as a custom domain on the `soit` Vercel
      project — both `justit.pt` and `www.justit.pt` attached and
      resolving (2026-10-01)
- [x] Update `NEXT_PUBLIC_SITE_URL` (Vercel env var) to the real domain
- [x] Update Supabase Auth's `site_url` and redirect allow-list to the
      real domain — done via the Dashboard (Authentication → URL
      Configuration): `site_url = https://justit.pt`,
      `https://justit.pt/**` and `https://www.justit.pt/**` added to
      the allow-list

## Email

- [x] Connect a real email provider — **Resend**, direct account (not
      the Vercel Marketplace listing, which only offers paid $20+/mo
      plans; Resend's own free tier covers this site's current volume).
      `src/lib/email/resend-provider.ts` implements `EmailProvider`;
      `console-provider.ts` deleted, `send.ts` now calls it for real.
- [x] Verify the sending domain (SPF/DKIM/DMARC) — `justit.pt` shows
      `status: "verified"`, `sending: enabled`, region `eu-west-1` in
      Resend
- [x] Custom SMTP for Supabase's own auth emails (confirm/
      reset-password/magic-link) — Dashboard → Authentication → SMTP
      Settings, `smtp.resend.com:465`, sender `noreply@justit.pt`.
      Verified live end-to-end: a real registration's confirmation
      email arrived from `noreply@justit.pt` (DKIM-signed for
      `justit.pt`, delivered via Amazon SES/Resend), and clicking
      through actually completed sign-in.
- [ ] **`hello@justit.pt` has no real mailbox behind it yet** — the
      contact form (`/recruit/contact`) sends there for real now (send
      confirmed via Resend's API, `last_event: "sent"`), but `justit.pt`
      has no MX record, so nothing is actually deliverable/readable
      there today. Needs a real mailbox provider (Google Workspace,
      Zoho Mail, Migadu, …) — recommended and not yet set up as of
      2026-10-01.

## Auth

- [x] Real OAuth credentials for Google/GitHub/LinkedIn/Facebook —
      **configured 2026-10-17**, via a direct `PATCH /v1/projects/
      {ref}/config/auth` (Management API, same mechanism as the
      password-policy change). All four confirmed live via a follow-up
      `GET` on the same endpoint: `external_github_enabled`,
      `external_linkedin_oidc_enabled`, `external_facebook_enabled`,
      and `external_google_enabled` all read `true`, each with its
      real `client_id` matching what was set. Secrets were never
      printed back or written to disk — confirmed by `client_id`/
      `enabled` only, the standard way to verify this kind of change
      without re-exposing a credential. **Not yet verified end-to-end**:
      no live OAuth consent-screen round trip has been driven in this
      environment (no browser automation available) — the buttons,
      click handlers, and `/auth/callback` exchange were already built
      and working beforehand (`AuthForm.tsx`, provider-agnostic); a
      real sign-in attempt through each provider is the next real test,
      whenever someone can click through it by hand.
- [x] Real code gap found 2026-09-29, **fixed 2026-10-17**:
      `ensureCandidateProfile()` (`src/lib/auth/complete-registration.ts`)
      now reads `user.app_metadata.provider` for `auth_provider` (was
      stuck on `"email"` always, via a `pending_auth_provider` field
      nothing ever set) and `user.user_metadata.full_name`/`name` +
      `avatar_url`/`picture` for name/avatar (previously never read at
      all). New migration `20261017200000_linkedin_oidc_provider.sql`
      renames the `auth_provider` enum's `'linkedin'` value to
      Supabase's real provider id `'linkedin_oidc'` — **needs `supabase
      db push` run by you**, same as every schema change in this
      project; not yet applied as of this writing. Verified via
      `tsc`/`eslint`/`check:i18n`/`npm run test`/`npm run build` only —
      real credentials now exist (see above) but no live OAuth round
      trip has actually been driven through this environment yet (no
      browser automation available here).

## Database / infra

- [ ] Decide Supabase Free vs Pro before real launch traffic —
      deliberately **not** upgrading yet (agreed 2026-09-29: no reason
      to pay while still developing). Confirmed directly: this project
      is on Free, 13MB DB (nowhere near any capacity limit). The actual
      risk isn't capacity, it's Free tier's **auto-pause after ~1 week
      of no API traffic** — the whole site goes down until manually
      resumed in the dashboard. Revisit this specifically once there's
      real, less-predictable production traffic. Pro also unlocks
      session timeout controls (see below) and better backup/PITR
      guarantees.
- [ ] Once on Pro (or otherwise): apply the already-declared
      `[auth.sessions]` block in `supabase/config.toml`
      (`inactivity_timeout = "2h"`, `timebox = "24h"`) via `supabase
      config push` — **read the file's own header warning about
      `auth.sms.twilio.enabled` first**, a blind push would silently
      disable a live, intentionally-enabled setting unrelated to this
      change
- [ ] If Pro is deferred past launch: build the inactivity-logout
      check as app-level middleware instead (discussed as the
      alternative to paying for the native feature)

## Map

- [ ] Real map tile provider — `JobMap.tsx`/`CompanyMap.tsx` both use
      OpenStreetMap's community tile server, explicitly flagged in
      code as dev-only and not licensed for commercial use (§8.1 of
      the spec). Pick MapTiler's free tier or self-hosted Protomaps
      before launch.

## Compliance / legal

- [x] Real privacy policy + terms content shipped 2026-10-18, revised the
      same day with real operating-entity details (round 2) — `/privacy`
      and `/terms` have real, codebase-audited content: controller
      identity (**PABC** — full legal name Paulo Adrega Brás Consulting, a
      Polish sole proprietorship, NIP `5242876773`, REGON `381799982`,
      verified against Poland's CEIDG registry — operating a
      Portuguese-market platform; this cross-border structure is stated
      plainly in both documents, not papered over), real GDPR article
      citations (Art. 6 lawful bases, Art. 15-21/77 rights, Art. 46(2)(c)
      transfers), actual data collected, actual cookies/localStorage
      (including Google Analytics now that it's real — see the
      cookie-banner item below), actual third-party processors, retention,
      and data-subject rights with real links to `/settings`. **The
      "AI-drafted, pending lawyer review" page banner was removed per
      explicit instruction** — that caveat is now communicated to the
      user directly rather than displayed on the page; the content itself
      was written to be as legally rigorous as possible, but it is still
      AI-drafted and a real lawyer should review it before it's relied on
      in an actual dispute. **Open item, flagged rather than resolved
      unilaterally**: the governing-law clause (Portugal, for the
      PT-focused service, with a note preserving the consumer's own
      mandatory-protection rights) is a reasonable default for a Polish
      entity serving a Portuguese consumer market, but the real
      cross-border consumer-protection interaction (Rome I Regulation
      Art. 6) deserves a lawyer's actual sign-off, not an AI's best
      guess — flagged back to the coordinator, not silently decided as
      final.
- [x] Cookie/consent banner — **now genuinely required and built**,
      reversing the prior round's "not currently required" finding now
      that the premise changed: Google Analytics (GA4, measurement ID
      `G-T7HJBP9W8L`) was added 2026-10-18, and GA's own cookies are not
      strictly necessary, so Art. 5(3) ePrivacy requires real prior
      consent. New `src/components/CookieConsentBanner.tsx` (mounted once
      in the true root `[locale]/layout.tsx`, the only layout wrapping
      every route group) shows Accept/Reject, remembers the choice in
      localStorage (`soit_cookie_consent`), and `gtag.js` is only rendered
      via `next/script` after an explicit "accept" — confirmed live via a
      real network-request check (not just code review) that zero
      requests to `googletagmanager.com`/`google-analytics.com` fire
      before consent, and that they do fire immediately after. The
      underlying facts from the prior audit (Supabase's own session
      cookie remains strictly necessary and consent-exempt; no locale
      cookie exists; the candidate/employer localStorage keys remain
      functional-only) are unchanged and still accurately described in
      the Privacy Policy's cookie section — only the GA piece is new.
- [x] §6.6 data-retention purge job — **built 2026-10-18**. Per the
      spec's exact text: applications + their CV snapshots are deleted
      12 months after `status_updated_at`; unclaimed `candidates` rows
      (no live applications) are deleted after 12 months (the spec
      doesn't name a trigger column for this half — `created_at` is
      used, a judgment call). New `src/lib/db/retention-purge.ts` +
      `src/app/api/cron/retention-purge/route.ts`, same
      `CRON_SECRET`-gated pattern as the saved-search digest cron, a new
      daily entry in `vercel.json`. Verified against the live database
      with real disposable fixtures (a backdated application + a real
      CV file in the `cvs` bucket, a backdated unclaimed candidate with
      zero applications, plus three negative controls — a recent
      application, a recent unclaimed candidate, and an old-but-still-
      has-a-live-application candidate) — all 7 checks passed: the old
      application and its storage file were removed, the old
      zero-application candidate was removed, and all three negative
      controls correctly survived. Also confirmed live against
      production data directly: nothing in the real database is
      currently older than ~3 weeks, so the real cron route (hit
      directly with the real `CRON_SECRET`) correctly reported zero
      purged — safe to run today, will start doing real work once data
      actually ages past 12 months.
- [ ] Decide whether to show a verified employer's NIF publicly on
      their company page (opt-in only, per the spec) — real trust
      signal consistent with the product's transparency thesis, but
      personal data for a sole trader; open decision from spec §15.1,
      never actually resolved either way

## Observability

- [ ] Error monitoring (e.g. Sentry) — **install attempted 2026-10-18,
      blocked on a real one-time account step, not a code gap**:
      `vercel integration add sentry` (the same Vercel-Marketplace-first
      pattern the Stripe integration used) returned
      `action_required: integration_terms_acceptance_required` — Sentry's
      own marketplace terms need accepting in a browser
      (`https://vercel.com/soit/~/integrations/accept-terms/sentry?source=cli`)
      before the install can finish; this can't be done from here (no
      browser session). Once accepted, re-run `vercel integration add
      sentry` to actually provision it, then wire up `@sentry/nextjs`
      for both client and server error capture — not done yet, since
      there's no real DSN to configure until the integration exists.
- [x] Basic analytics — **Google Analytics (GA4) added 2026-10-18**,
      gated behind a real consent banner (see Compliance/legal above) —
      the spec's own original suggestion was a cookie-free tool
      (Plausible/Umami) specifically to avoid needing a consent flow at
      all; GA was the user's explicit choice instead, so the consent
      banner this requires is a real, deliberate trade-off, not an
      oversight.

## SEO

- [x] Google Search Console — **done, verified by the user directly** via
      a DNS TXT record (2026-10-18). `sitemap.xml`/`robots.txt` re-checked
      the same day and still correctly derive from `NEXT_PUBLIC_SITE_URL`
      at runtime (`https://justit.pt` in production) — nothing to submit
      beyond what's already live.
- [x] `sitemap.xml`/`robots.txt` re-confirmed against the real host
      2026-10-17 — both derive their host from `NEXT_PUBLIC_SITE_URL`
      at runtime (no hardcoded domain), which is already
      `https://justit.pt` in production, so both are correct with zero
      further action needed
- [x] Real SEO audit, 2026-10-18 — checked the actual technical surface
      (not Google's live Rich Results tool, unreachable from here — the
      `JobPosting` JSON-LD was instead validated directly against
      schema.org's/Google's documented required+recommended fields).
      Found and fixed real gaps:
      - `JobPosting` JSON-LD was missing `hiringOrganization.logo`
        (Google's own guidance for the logo to appear in Rich Results)
        and an `identifier` `PropertyValue` — both added, using data
        already joined into the query (no new query).
      - **Zero pages anywhere in the app set Open Graph or Twitter Card
        metadata** (confirmed via a repo-wide grep) — a shared job link
        on Slack/LinkedIn/WhatsApp rendered with only the generic
        site-level title, no description, no image. New
        `src/lib/seo.ts` (`socialMeta()`) now sets real `openGraph`/
        `twitter` on the root layout, `/jobs`, `/companies`, every job
        detail page (with a real per-job description, previously
        missing entirely, and the real company logo as the image), and
        every company profile page (the company's own logo).
      - **Canonical + hreflang existed on exactly one route** (the job
        detail page) before this — confirmed absent on the root layout,
        `/jobs` (which carries all its filter state in query params,
        a real duplicate-content risk with zero canonical pointing
        back), `/companies`, and `/companies/[slug]`. New
        `localeAlternates()` helper (same `src/lib/seo.ts`) replicates
        the job detail page's own correct pattern (`x-default` +
        per-locale pairing) everywhere else.
      - Verified live against the real dev server + real published
        jobs/companies: canonical/hreflang/OG/Twitter all render
        correctly on the homepage, `/jobs`, `/companies`, a real job
        detail page (using that job's real company logo as the OG
        image), and a real company page (its own logo + real
        description) — and the noindex preview route's
        `robots: noindex` still correctly overrides the shared
        metadata, unaffected by this change.
      - Not done this round, still worth a spot-check before launch:
        running the actual job page through Google's live Rich Results
        Test tool once a browser is available — this round validated
        against the documented spec, not Google's own live validator.

## Admin panel

- [ ] **Build a real admin panel before launch** — recommended
      2026-09-29 (asked directly, giving an honest opinion): confirmed
      there is currently zero admin panel or admin role anywhere in
      this codebase. Every admin-style action this project has needed
      so far (confirming a stuck signup whose confirmation email never
      arrived, resetting a candidate's password, and now reviewing
      pending skill tags) has been done via one-off Node scripts
      against the service-role key — fine during development, not
      viable once real users exist and you need to act without asking
      an AI assistant to write a script each time. Minimum real scope:
      account fixes (email confirm/password reset), company
      verification override (fallback when the automated NIF/VIES
      lookup fails), tech-tag vocabulary curation (the new
      `skill_suggestions` table, added 2026-09-29, is explicitly meant
      to be this screen's first real data — every CV-parse skill/
      language label that didn't match the real vocab, with an
      occurrence count), and basic abuse/moderation. Big enough to be
      its own planning pass, not something to bolt onto another phase.

## Billing / Stripe

- [ ] Currently on a Stripe **sandbox/test-mode** resource
      (`stripe-camel-ribbon`, provisioned via `vercel integration add
      stripe` 2026-09-30) — claim it (`vercel integration resource claim`)
      and switch to live mode before real money should move. Test-mode
      keys (`sk_test_...`) are in `.env.local`/Vercel dev env only.
- [ ] The Stripe webhook (`/api/stripe/webhook`) only has a signing
      secret configured for local dev (via `stripe listen`). Before
      production traffic hits it: register a real webhook endpoint
      pointing at the real domain in the Stripe Dashboard (or via the
      API) and set ITS OWN `STRIPE_WEBHOOK_SECRET` in Vercel's
      production env — the local dev secret is not valid for it.
- [ ] Currently using the Vercel-provisioned `STRIPE_SECRET_KEY`
      (full access). The Stripe security skill's own recommendation:
      switch to a restricted API key (`rk_...`) scoped to only what
      `src/lib/stripe.ts` actually calls (Checkout Sessions, Prices,
      Products, webhook construction) before going live — narrows the
      blast radius if it ever leaks.
- [ ] **Stripe Tax not configured.** Charging real customers (especially
      in the EU) needs VAT handling — either enable Stripe Tax
      (`automatic_tax`) with an active tax registration, or handle VAT
      manually. Nothing here charges tax today; confirm this deliberately
      before real invoices go out, not by omission.
- [x] Top Employer's own subscription checkout/webhook lifecycle, its
      badge/site-wide placement, the rich company profile content, and
      API access (phases 2–4 of the pricing work) are all built and
      verified live on both environments — see CLAUDE.md. Public API
      docs at `/developers`, linked from the pricing page, shipped
      2026-10-01. **Pricing itself changed since then**: Top Employer
      is now a flat **€500/mo or €5,000/yr** (2 months free paid
      annually), with the old bundled-10-job-slots perk removed —
      every verified company, Top Employer included, gets the same
      1-free-job standing allowance, and ad credits are bought
      separately by anyone (round 33, commit `202c117`). Confirmed
      live 2026-10-17: the pricing page renders exactly €500/€5000,
      and the new `top_employer_monthly_v2`/`top_employer_annual_v2`
      Stripe Prices exist and are what Checkout references now.
- [ ] **Two real Top Employer subscriptions are still on the OLD,
      pre-round-33 `top_employer_annual` Stripe Price** — confirmed
      live again 2026-10-17 (unresolved since round 33, not a new
      finding on its own, but worth restating since this doc hadn't
      captured it until now). Stripe Prices are immutable, so a
      pricing change never moves an existing subscriber — this isn't a
      bug, just a standing fact; whether/when to migrate them (or just
      let them keep renewing at the old price) is a business decision,
      not a code one. The two real subscriptions:
      - **ITDS** (`company_id 7c056b01-...`) — correctly synced,
        `top_employer_active: true`.
      - **"Test Company"** (`company_id 01f26edb-...`) — **fixed
        2026-10-18**: Stripe showed this subscription `status: active`
        (renews 2027-09-30), but `companies.top_employer_active` read
        **false** — a real, previously-undocumented desync. Corrected
        directly (`update companies set top_employer_active = true
        where id = '01f26edb-87d5-4962-a331-ebbdf9698cb8'`), confirmed
        before/after via a direct read. The root cause was never
        recoverable (Postgres/Supabase keeps no row-level history to
        inspect) — most likely a stray manual/test write against this
        specific company at some point, not a reproducible app bug;
        flagging that this was a one-time correction, not a fix to an
        underlying mechanism, in case it recurs.
- [x] **The Stripe webhook domain gap — fixed and fully verified
      2026-10-18.** The old webhook endpoint
      (`we_1ULLehEfmibRYZh3Dw0cZ06p`) was registered at
      `https://soit.vercel.app/api/stripe/webhook` — since 2026-10-09's
      canonical-domain redirect, `soit.vercel.app` 308-redirects every
      path (webhook included) to `justit.pt`, and Stripe doesn't follow
      redirects for webhook delivery, so real subscription-lifecycle
      events had likely been silently failing since then. Registered a
      new endpoint (`we_1URtMFEfmibRYZh34RIpX4G7`) at the real
      `https://justit.pt/api/stripe/webhook`, subscribed to the same 5
      events (`checkout.session.completed`,
      `checkout.session.async_payment_succeeded`,
      `checkout.session.async_payment_failed`,
      `customer.subscription.updated`, `customer.subscription.deleted`),
      and set its real signing secret as `STRIPE_WEBHOOK_SECRET` in
      Vercel's **production** environment only (preview/development
      untouched — they still need the local `stripe listen` secret).
      A first verification attempt (same session, before the next
      production deploy) correctly came back `400 signature verification
      failed` — the env var hadn't taken effect yet, per this project's
      own documented redeploy gotcha. **After the user's production
      deploy, re-verified end-to-end**: a real signed test event
      (`stripe.webhooks.generateTestHeaderString`) against the live
      `https://justit.pt/api/stripe/webhook` returned a real `200`,
      correctly granted an ad credit and logged a `job_ad_purchases`
      row on a disposable test company, and a replay of the identical
      event confirmed idempotency (credit stayed at 1, not 2) — fixture
      cleaned up after. **The old `soit.vercel.app` endpoint has now
      been disabled** (not deleted — kept for audit/history) via the
      Stripe API; confirmed via a follow-up list call that exactly one
      endpoint is enabled (`justit.pt`) and the old one shows
      `status: disabled`.
- [ ] The "6+ ads" tier is deliberately not self-serve (a "talk to
      sales" contact link only) — when a real deal happens, the Stripe
      Checkout Session/invoice for it is created manually via the
      Dashboard, not through this codebase's checkout action. Still
      accurate as designed — not an open task, just restating the
      deliberate behavior for anyone reading this section top to
      bottom.

## Product / business (not code)

- [x] Pricing model — the real business-model conversation happened
      2026-09-30, grounded in real competitor pricing (justjoin.it,
      LinkedIn, Indeed) and one real data point (an existing customer's
      actual spend at scale on a competitor board). Both products it
      defined are now fully built and live, confirmed again 2026-10-17:
      self-serve job-ad credits (4 one-time packs, volume-discounted)
      and a Top Employer subscription — though the latter's own pricing
      changed partway through (round 33): flat **€500/mo or €5,000/yr**
      now, not the original discount-curve design, once bundling 10
      free job slots into it turned out to double up against the
      1-free-job standing allowance every verified company already
      gets. See CLAUDE.md's "Employer pricing & billing" entries for
      the full history, and the Billing/Stripe section above for the
      two real subscribers still grandfathered on the pre-round-33
      price (one of which has a separate, currently-open sync issue).
- [x] Contact/support channel, email half — `/recruit/contact` page
      shipped 2026-09-29 (employer-only by your own explicit call, not
      a general/candidate channel — genuinely gated via the console's
      own auth guard, not just unlinked). Sends for real now (Resend,
      confirmed `last_event: "sent"`) — but see the `hello@justit.pt`
      mailbox gap in the Email section above: sent isn't the same as
      readable yet.
- [ ] Contact/support channel, chat half — deliberately skipped for
      now (2026-09-29); building real-time chat from scratch isn't
      worth it, a third-party widget (Crisp recommended) is the right
      call if/when this gets revisited
- [ ] **Cold-start supply plan** (spec §15.2, called out as "the risk
      the spec cannot engineer away") — a job board with zero listings
      converts nobody. Needs a manual outreach plan (target list of
      nearshore/GBS centres + Portuguese IT employers, a concierge
      "we'll post your first ad for you, free" offer) lined up
      *before* demoing this to anyone, not discovered after — this is
      explicitly a business problem, not a build problem, and nothing
      in the codebase can check it off for you
