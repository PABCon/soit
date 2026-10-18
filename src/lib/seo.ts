import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DEFAULT_OG_IMAGE = `${SITE}/logo-justit.png`;

/**
 * SEO audit (go-live round): hreflang/canonical existed on exactly one
 * route (the job detail page) before this — confirmed absent on the root
 * layout, `/jobs`, `/companies`, and `/companies/[slug]` by direct
 * inspection. Extracted into a shared helper so every page gets the exact
 * same correct `x-default` + per-locale pairing the job detail page's own
 * implementation already had right, instead of each page reinventing it
 * (or not).
 */
export function localeAlternates(path: string, locale: string): Metadata["alternates"] {
  return {
    canonical: `${SITE}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `${SITE}/${l}${path}`])),
      "x-default": `${SITE}/`,
    },
  };
}

/**
 * Open Graph + Twitter card defaults. No page in this codebase set either
 * before this (confirmed via a repo-wide grep) — a shared job link posted
 * to Slack/LinkedIn/WhatsApp would previously render with only the
 * generic root `<title>`/description, no image, no per-page context.
 * `image` defaults to the real site logo (`public/logo-justit.png`) when
 * a page has nothing more specific (e.g. a company logo) — never a
 * fabricated/placeholder graphic.
 */
export function socialMeta({
  title,
  description,
  url,
  image,
}: {
  title: string;
  description?: string;
  url: string;
  image?: string | null;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const resolvedImage = image ?? DEFAULT_OG_IMAGE;
  return {
    openGraph: {
      title,
      description,
      url,
      siteName: "Just IT",
      type: "website",
      images: [{ url: resolvedImage }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [resolvedImage],
    },
  };
}
