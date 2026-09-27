import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const LINKEDIN_PATH =
  "M6.5 8.5h3V18h-3V8.5Zm1.5-4a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4ZM11.5 8.5h2.9v1.3h.04c.4-.75 1.4-1.55 2.9-1.55 3.1 0 3.66 2 3.66 4.7V18h-3v-4.4c0-1.05-.02-2.4-1.46-2.4-1.47 0-1.7 1.15-1.7 2.33V18h-3V8.5Z";

/** Site-wide footer (§7.3): one row of page links + socials, one row of
 *  legal links + copyright. Rendered from every candidate-facing shell
 *  (candidate)/(auth)/(preview)/(legal) for consistency. The LinkedIn icon
 *  only renders when NEXT_PUBLIC_LINKEDIN_URL is actually set — no
 *  guessed/placeholder URL, a wrong one would be genuinely misleading.
 *
 *  `prefetch={false}` on every link here is load-bearing, not cosmetic: a
 *  real production bug traced back to this footer being on the login page
 *  — Next.js's automatic Link prefetch fetched `/recruit` (redirecting to
 *  login, since that prefetch runs pre-auth) in the background the moment
 *  the login page loaded, and that response landed in the client Router
 *  Cache under the same path the post-login `router.push("/recruit")`
 *  needed a fraction of a second later — reusing the stale pre-auth
 *  response and leaving the login button stuck on its loading state
 *  forever. Dev mode doesn't prefetch as aggressively, so this only ever
 *  showed up against the real production build. */
export async function Footer() {
  const t = await getTranslations("footer");
  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL;

  return (
    <footer className="mt-16 border-t border-line px-4 py-8 text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label={t("pagesNav")}>
            <Link href="/jobs" prefetch={false} className="hover:text-ink">
              {t("jobs")}
            </Link>
            <Link href="/companies" prefetch={false} className="hover:text-ink">
              {t("companies")}
            </Link>
            <Link href="/recruit" prefetch={false} className="hover:text-ink">
              {t("postJob")}
            </Link>
          </nav>
          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              title="LinkedIn"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-muted transition-colors hover:bg-pine hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d={LINKEDIN_PATH} />
              </svg>
              <span className="sr-only">LinkedIn</span>
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs">
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label={t("legalNav")}>
            <Link href="/privacy" prefetch={false} className="hover:text-ink">
              {t("privacy")}
            </Link>
            <Link href="/terms" prefetch={false} className="hover:text-ink">
              {t("terms")}
            </Link>
          </nav>
          <p>{t("copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
