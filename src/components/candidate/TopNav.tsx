import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * Public top nav (§7.3): role-split Log in dropdown + Add offer + search +
 * language switcher. The dropdown is a <details> so it needs no client JS
 * and stays keyboard accessible. Its items are inert until auth lands in
 * build step 3 — the role-split entry point is that step's deliverable.
 */
export function TopNav() {
  const t = useTranslations("nav");
  const brand = useTranslations("brand");

  const item =
    "block w-full cursor-not-allowed px-3 py-2 text-left text-sm text-muted";

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/jobs" className="font-display text-lg font-bold text-pine">
          {brand("name")}
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <label className="hidden sm:block">
            <span className="sr-only">{t("search")}</span>
            <input
              type="search"
              placeholder={t("search")}
              className="h-9 w-56 rounded-lg border border-line bg-white px-3 text-sm placeholder:text-muted"
            />
          </label>

          <LanguageSwitcher />

          <details className="relative">
            <summary className="flex h-9 cursor-pointer list-none items-center rounded-lg px-3 text-sm font-medium text-ink hover:bg-white">
              {t("login")}
            </summary>
            <div className="absolute right-0 mt-1 w-64 rounded-lg border border-line bg-white py-1 shadow-sm">
              <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-ink">
                {t("groupCandidate")}
              </p>
              <span className={item} aria-disabled="true">
                {t("loginAsCandidate")}
              </span>
              <span className={item} aria-disabled="true">
                {t("registerAsCandidate")}
              </span>
              <hr className="my-1 border-line" />
              <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-ink">
                {t("groupEmployer")}
              </p>
              <span className={item} aria-disabled="true">
                {t("loginAsEmployer")}
              </span>
              <span className={item} aria-disabled="true">
                {t("registerAsEmployer")}
              </span>
            </div>
          </details>

          <Link
            href="/recruit"
            className="flex h-9 items-center rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90"
          >
            {t("addOffer")}
          </Link>
        </div>
      </div>
    </header>
  );
}
