import * as Sentry from "@sentry/nextjs";

// Covers the Edge runtime — `proxy.ts` (Next 16's renamed middleware
// convention) and any route explicitly opted into `runtime: "edge"`
// (none exist in this codebase today, but this still needs to be wired
// since `proxy.ts` itself runs on the Edge runtime).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
