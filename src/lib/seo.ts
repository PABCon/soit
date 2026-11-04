import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

const { defaultLocale } = routing;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
// Real-usage report: a justit.pt/jobs link shared in iMessage rendered its
// thumbnail as a cropped "Jst" fragment — `logo-justit.png` is an 800x318
// wordmark (2.5:1), and a link-preview thumbnail crop (square on iMessage,
// 1.91:1 on most others) just cuts off most of a wide wordmark regardless
// of platform. `og-image.png` is a dedicated 1200x630 share image instead
// — the icon mark + wordmark + tagline are all centered inside the
// 630x630 middle band, so even the tightest (square) crop a platform can
// apply still shows the complete lockup, never a fragment.
const DEFAULT_OG_IMAGE = `${SITE}/og-image.png`;
const DEFAULT_OG_IMAGE_WIDTH = 1200;
const DEFAULT_OG_IMAGE_HEIGHT = 630;

/**
 * SEO audit (go-live round): hreflang/canonical existed on exactly one
 * route (the job detail page) before this — confirmed absent on the root
 * layout, `/jobs`, `/companies`, and `/companies/[slug]` by direct
 * inspection. Extracted into a shared helper so every page gets the exact
 * same correct `x-default` + per-locale pairing the job detail page's own
 * implementation already had right, instead of each page reinventing it
 * (or not).
 *
 * Screaming Frog audit (Nov 2026): `x-default` pointed at the bare,
 * un-prefixed root (`SITE/`) — but `routing.localePrefix` is "always", so
 * that URL only ever 307-redirects to the default locale via middleware,
 * never itself returns 200. Every page on the site carries this same tag,
 * which is exactly why the crawl flagged ~97% of URLs as having a
 * non-200 hreflang target. `x-default` now points at the default
 * locale's own real URL instead, matching that locale's `languages` entry
 * exactly (same value, not a near-duplicate) so it's always a real,
 * directly-indexable 200.
 */
export function localeAlternates(path: string, locale: string): Metadata["alternates"] {
  return {
    canonical: `${SITE}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `${SITE}/${l}${path}`])),
      "x-default": `${SITE}/${defaultLocale}${path}`,
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
  imageIsLandscape,
}: {
  title: string;
  description?: string;
  url: string;
  image?: string | null;
  /** Set when a custom `image` is also a 1200x630 landscape banner (e.g.
   *  the salary calculator's per-result share image) rather than something
   *  arbitrary like a company logo — declares the real dimensions instead
   *  of leaving them unset. */
  imageIsLandscape?: boolean;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const usingDefaultImage = !image;
  const resolvedImage = image ?? DEFAULT_OG_IMAGE;
  const declareDimensions = usingDefaultImage || imageIsLandscape;
  return {
    openGraph: {
      title,
      description,
      url,
      siteName: "Just IT",
      type: "website",
      images: [
        declareDimensions
          ? { url: resolvedImage, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT }
          : { url: resolvedImage },
      ],
    },
    // "summary_large_image" over the previous "summary": a company logo
    // (the other real caller of this function, via `image`) is usually
    // close to square and reads fine at summary size, but the default
    // share image above is a 1200x630 landscape banner purpose-built for
    // the large-image treatment.
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [resolvedImage],
    },
  };
}
