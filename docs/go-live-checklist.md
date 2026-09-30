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

- [ ] Add real OAuth credentials for Google/GitHub/LinkedIn — the
      buttons, click handlers, and `/auth/callback` exchange are all
      already built and working (`AuthForm.tsx`, provider-agnostic);
      confirmed all three are wired in code but disabled
      (`external_*_enabled: false`) on the live project since no
      `[auth.external.*]` block exists yet for any of them in
      `supabase/config.toml`. Each provider needs its own app created
      on **your own account** on that provider's platform — not
      something that can be done on your behalf:
      - **Google**: Google Cloud Console → new OAuth 2.0 Client ID
        (Web application) → authorized redirect URI
        `https://<project-ref>.supabase.co/auth/v1/callback`
      - **GitHub**: github.com/settings/developers → New OAuth App →
        same callback URL as the "Authorization callback URL"
      - **LinkedIn**: LinkedIn Developer Portal → new app → request
        the "Sign In with LinkedIn using OpenID Connect" product →
        same callback URL as an authorized redirect URI
      Once you have each Client ID/Secret, paste them into Supabase
      Dashboard → Authentication → Providers (or hand them over and
      they can be set via the Management API).
- [ ] Real code gap found 2026-09-29, not yet fixed:
      `ensureCandidateProfile()` (`src/lib/auth/complete-registration.ts`)
      never actually reads what an OAuth provider returns — `avatar_url`
      is never set by any path, `full_name` falls back to the email's
      local-part, and `auth_provider` always resolves to `"email"`
      (reads a `pending_auth_provider` field nothing in the codebase
      ever sets). Fix is scoped and ready to execute (read
      `user.app_metadata.provider`/`user.user_metadata` instead) — see
      Phase 5 of `~/.claude/plans/refactored-zooming-wren.md`. Also
      needs a one-line migration (`auth_provider` enum still has the
      old value `'linkedin'`, not Supabase's real provider id
      `'linkedin_oidc'`). Doesn't need any credentials to build — only
      needs a real provider connected to verify end-to-end.
- [ ] Facebook login is not wired at all yet (only Google/GitHub/
      LinkedIn buttons exist) — add if/when wanted; Meta's own app
      review process is stricter than the other three providers.

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

- [ ] Real privacy policy + terms content — `/privacy` and `/terms`
      are still placeholder pages ("this page is being prepared")
- [ ] Cookie/consent banner — not built; blocked on picking an
      analytics tool first (below)
- [ ] §6.6 data-retention purge job — specified, not built
- [ ] Decide whether to show a verified employer's NIF publicly on
      their company page (opt-in only, per the spec) — real trust
      signal consistent with the product's transparency thesis, but
      personal data for a sole trader; open decision from spec §15.1,
      never actually resolved either way

## Observability

- [ ] Error monitoring (e.g. Sentry) — none configured
- [ ] Basic analytics — none configured. Spec's own recommendation:
      Plausible or Umami (cookie-free), which keeps the consent banner
      above trivial rather than a full GA4-style consent flow

## SEO

- [ ] Submit the real domain to Google Search Console; run the Rich
      Results Test against a real job page's `JobPosting` JSON-LD
- [ ] Re-confirm `sitemap.xml`/`robots.txt` once the real domain is live
      (both already exist and are dynamically generated — just need
      re-checking against the real host, not rebuilding)

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
      2026-10-01.
- [ ] The "6+ ads" tier is deliberately not self-serve (a "talk to
      sales" contact link only) — when a real deal happens, the Stripe
      Checkout Session/invoice for it is created manually via the
      Dashboard, not through this codebase's checkout action.

## Product / business (not code)

- [x] Pricing model — the real business-model conversation finally
      happened 2026-09-30, grounded in real competitor pricing (justjoin.it,
      LinkedIn, Indeed) and one real data point (an existing customer's
      actual spend at scale on a competitor board), reverse-engineered
      into a volume-discount curve rather than guessed at. Two products:
      self-serve job-ad credits (building now) and a Top Employer
      subscription (scoped, not built yet). See CLAUDE.md's "Employer
      pricing & billing" entries for the full numbers and reasoning.
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
