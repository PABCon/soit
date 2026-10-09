"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Dropdown } from "@/components/Dropdown";

const LOCALE_LABELS: Record<Locale, string> = { pt: "Português", en: "English" };

/**
 * Switches locale while preserving the current path (§2.2). A compact
 * trigger + dropdown (real-usage report: showing both locales side by side
 * at all times read as cluttered), closes on outside click via the shared
 * `Dropdown`.
 * usePathname() here returns the path WITHOUT the locale prefix and with
 * dynamic segments already resolved, so the plain string form is correct.
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");

  return (
    <Dropdown
      triggerLabel={t("language")}
      triggerClassName="flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm font-medium text-ink hover:bg-white"
      panelClassName="w-36 rounded-lg border border-line bg-white py-1 shadow-sm"
      trigger={
        <>
          {locale.toUpperCase()}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </>
      }
    >
      {(close) =>
        routing.locales.map((l: Locale) => {
          const active = l === locale;
          return (
            <button
              key={l}
              type="button"
              lang={l}
              aria-current={active ? "true" : undefined}
              onClick={() => {
                close();
                if (!active) router.replace(pathname, { locale: l });
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink hover:bg-paper"
            >
              {LOCALE_LABELS[l]}
              {active && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4 text-pine"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          );
        })
      }
    </Dropdown>
  );
}
