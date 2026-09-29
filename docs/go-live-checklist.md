# Go-live checklist

Everything flagged as "before launch" / "deferred" / "known gap" across
this project's build (see `CLAUDE.md` for the full history, and
`docs/mvp-build-spec.md` §14 step 9 / §15.1 for where several of these
were first called out), consolidated in one place so nothing gets
launched-past silently. Grounded against the live project's actual
current state (checked directly via the Supabase Management API and
Vercel, not assumed) as of 2026-09-29 — update this file as items close,
same as every other doc in this project.

Not a step-by-step build plan — these are independent, tick off in
whatever order makes sense.

## Domain & DNS

- [ ] Register/confirm `justit.pt` (in progress)
- [ ] Point DNS at Vercel; add as a custom domain on the `soit` Vercel
      project
- [ ] Update `NEXT_PUBLIC_SITE_URL` (Vercel env var) to the real domain
- [ ] Update Supabase Auth's `site_url` and redirect allow-list to the
      real domain — confirmed still `https://soit-soit.vercel.app/` +
      Vercel preview URL patterns only; `https://soit.vercel.app/**` is
      in the allow-list (that gap closed at some point), but the real
      domain isn't yet

## Email

- [ ] Connect a real email provider (Resend/Postmark) — `src/lib/
      email/` already has the provider interface and two real,
      fully-built templates (application confirmation, new applicant);
      swapping `ConsoleEmailProvider` for a real one is a one-line
      change once a provider + API key exist
- [ ] Verify the sending domain (SPF/DKIM/DMARC) — needs the real
      domain first
- [ ] Consider custom SMTP for Supabase's own auth emails (confirm/
      reset-password/magic-link) — confirmed still on Supabase's
      default sender (no `smtp_host` configured), which is rate-limited
      enough to slow down real usage, not just local testing

## Auth

- [ ] Add real OAuth credentials for Google/GitHub/LinkedIn in the
      Supabase dashboard — confirmed all three are still wired in code
      but disabled (`external_*_enabled: false`) on the live project

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

## Product / business (not code)

- [ ] Pricing model — deferred at your own request; needs a real
      business-model pass (compare against LinkedIn's model, not just
      port justjoin.it's tiers) before building any billing
- [x] Contact/support channel, email half — `/contact` page shipped
      2026-09-29, sends through the same not-yet-connected email
      pipeline as everything else (see Email section above)
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
