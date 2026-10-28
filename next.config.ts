import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";
// @sentry/nextjs 11.8.0 moved this to a dedicated `/config` subpath — the
// main package export has no `withSentryConfig` at all (confirmed by
// inspecting the installed package's own `exports` map, not assumed from
// older docs/memory).
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Pin the workspace root: an unrelated lockfile higher up the tree would
  // otherwise be inferred as the root.
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  // Security audit finding: zero security headers were configured
  // anywhere (confirmed live — only `strict-transport-security`, added
  // automatically by Vercel's edge, was present). Missing
  // `X-Frame-Options` specifically meant `/employer/login`,
  // `/candidate/login`, and the apply flow could be framed by an
  // attacker-controlled page for a clickjacking overlay. A full
  // Content-Security-Policy is deliberately NOT added here — this app
  // loads Stripe Checkout, Sentry, Google Analytics, MapTiler tiles, and
  // Google Fonts across many different pages, and shipping a CSP wrong
  // (too strict) risks silently breaking one of those without a full
  // per-page audit this pass didn't have room for; a wrong CSP is a worse
  // outcome than no CSP. These four are zero-risk, well-understood
  // defaults that can't break legitimate functionality.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Real-usage report: visiting (or bookmarking) the raw Vercel alias
      // never redirected to the real domain, so the address bar stayed on
      // soit.vercel.app through login and everything else — Vercel
      // doesn't canonicalize this on its own. Only the *stable* project
      // alias, not per-deployment preview URLs (soit-<hash>-soit.vercel.app)
      // — those intentionally stay reachable for inspecting one exact
      // build.
      {
        source: "/:path*",
        has: [{ type: "host", value: "soit.vercel.app" }],
        destination: "https://justit.pt/:path*",
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      // Next's own default (1MB) is below the `branding` storage bucket's
      // 2MB image cap (supabase/migrations/20260921120200_storage.sql), so
      // any logo/cover upload between 1-2MB — which the bucket would
      // otherwise accept — crashed with a raw framework 500 before
      // uploadImageAction's own file-size check ever got a chance to run.
      bodySizeLimit: "3mb",
    },
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Real Sentry project (org "justit-ol", project "justit") — the user's
  // own, created directly, not the Vercel Marketplace integration (which
  // was blocked on a marketplace-terms acceptance step; this is a
  // separate, already-working path).
  org: "justit-ol",
  project: "justit",
  // Source-map upload only happens with a real token present (CI/Vercel
  // builds); a local dev build with no SENTRY_AUTH_TOKEN set just skips
  // the upload step rather than failing.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
