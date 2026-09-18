import { defineRouting } from "next-intl/routing";

/**
 * Both locales are explicitly prefixed (/pt/..., /en/...) — neither is bare.
 * An unambiguous prefix per locale keeps hreflang clean and avoids the
 * bare-root duplicate-content problem. `/` redirects on Accept-Language,
 * defaulting to pt: this is a .pt domain and Portuguese is the home market.
 * Spec §2.2.
 */
export const routing = defineRouting({
  locales: ["pt", "en"],
  defaultLocale: "pt",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
