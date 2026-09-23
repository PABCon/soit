import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Console/settings/auth pages already declare their own `noindex` via
// generateMetadata — no need to duplicate that here with disallow rules
// that could conflict with it. API routes just aren't pages.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api" }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
