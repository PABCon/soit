"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Console-only sales tactic for the rich-profile sections (billing phase
 *  3): a non-Top-Employer owner sees their own editor blurred, not hidden
 *  outright, with a teaser CTA to upgrade. This is deliberately NOT how the
 *  public profile page gates the same content — that side just omits the
 *  fields entirely (see `getCompanyBySlug`), no blur trick shown to
 *  candidates. */
export function TopEmployerBlurGate({ children }: { children: ReactNode }) {
  const t = useTranslations("console");
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none opacity-60 blur-sm select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/50 p-4 text-center">
        <p className="max-w-xs text-sm font-medium text-ink">{t("richProfileTeaser")}</p>
        <Link
          href="/recruit/jobs/ads"
          className="inline-flex h-9 items-center rounded-lg bg-pine px-4 text-sm font-semibold text-white hover:bg-pine/90"
        >
          {t("richProfileTeaserCta")}
        </Link>
      </div>
    </div>
  );
}
