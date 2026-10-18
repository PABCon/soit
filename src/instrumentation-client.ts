import * as Sentry from "@sentry/nextjs";

// Real Sentry project (not the Vercel Marketplace integration — the user's
// own pre-existing project, org "justit-ol", project "justit"). The DSN is
// public by design (it only lets a client *send* events, never read data),
// which is why it's a NEXT_PUBLIC_ var rather than a secret.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  // Noisy locally during development; harmless to leave on, but keeps
  // server/dev console output quieter.
  debug: false,
});
