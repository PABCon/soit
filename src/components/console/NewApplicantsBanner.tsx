"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, X } from "lucide-react";
import { Link } from "@/i18n/navigation";

const DISMISSED_KEY = "soit_new_applicants_banner_dismissed_count";

function wasAlreadyDismissed(count: number): boolean {
  try {
    const dismissedCount = localStorage.getItem(DISMISSED_KEY);
    return dismissedCount !== null && Number(dismissedCount) === count;
  } catch {
    return false;
  }
}

/** Round 22 — reuses the dashboard stat's already-computed
 *  `newApplicantsLast7Days` number, no new backend. Dismissal is a
 *  lightweight per-browser localStorage flag (not worth a DB column for
 *  something this low-stakes) — but it stores the *count* that was
 *  dismissed, not just a boolean, so the banner correctly reappears once
 *  a genuinely new applicant arrives later and the number changes,
 *  rather than staying silently dismissed forever. A lazy `useState`
 *  initializer, not a `useEffect`, reads localStorage — this component's
 *  whole tree is freshly mounted on every real page load (the count
 *  comes from a Server Component prop), so there's no case where `count`
 *  changes under an already-mounted instance that a one-time read would
 *  miss, and it avoids the cascading-render anti-pattern
 *  `react-hooks/set-state-in-effect` already flags elsewhere in this app. */
export function NewApplicantsBanner({ count }: { count: number }) {
  const t = useTranslations("console");
  const [dismissed, setDismissed] = useState(() => wasAlreadyDismissed(count));

  if (count === 0 || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(count));
    } catch {
      // Private browsing / blocked storage — the banner just won't stay
      // dismissed across a reload, not worth failing over.
    }
    setDismissed(true);
  }

  return (
    <div className="mt-4 flex items-center gap-4 rounded-xl border border-line bg-pine/5 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
        <UserPlus className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{t("newApplicantsBannerTitle", { count })}</p>
        <p className="text-sm text-muted">{t("newApplicantsBannerSubtitle")}</p>
      </div>
      <Link
        href="/recruit/applicants"
        className="flex h-9 shrink-0 items-center rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90"
      >
        {t("viewApplicants")}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismissBanner")}
        className="shrink-0 text-muted hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
