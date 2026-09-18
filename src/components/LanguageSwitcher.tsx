"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Switches locale while preserving the current path (§2.2).
 * usePathname() here returns the path WITHOUT the locale prefix and with
 * dynamic segments already resolved, so the plain string form is correct.
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1" role="group">
      {routing.locales.map((l: Locale) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-current={active ? "true" : undefined}
            onClick={() => !active && router.replace(pathname, { locale: l })}
            className={
              active
                ? "rounded px-1.5 py-0.5 text-xs font-semibold text-ink"
                : "rounded px-1.5 py-0.5 text-xs text-muted hover:text-ink"
            }
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
