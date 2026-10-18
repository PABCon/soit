import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors from nested React Server Components that `error.tsx`
// boundaries can't see (requires @sentry/nextjs 8.28+ and Next 15+, both
// satisfied here — @sentry/nextjs 11.8.0 / Next 16.3.8).
export const onRequestError = Sentry.captureRequestError;
