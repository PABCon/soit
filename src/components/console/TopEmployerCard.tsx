"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  createTopEmployerCheckoutAction,
  type BillingInterval,
} from "@/app/[locale]/(console)/recruit/jobs/ads/actions";

const PERK_KEYS = [
  "topEmployerPerkBadge",
  "topEmployerPerkPlacement",
  "topEmployerPerkApi",
  "topEmployerPerkBumps",
  "topEmployerPerkProfile",
  "topEmployerPerkSlots",
] as const;

export function TopEmployerCard({ active }: { active: boolean }) {
  const t = useTranslations("console");
  const locale = useLocale();
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setError(null);
    setPending(true);
    try {
      const result = await createTopEmployerCheckoutAction(interval, locale);
      if (result.ok) {
        window.location.assign(result.url);
        return;
      }
      setError(t("errorGeneric"));
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-amber-400 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-amber-600 uppercase">{t("topEmployerBadgeLabel")}</p>
          <h3 className="font-display text-xl font-bold text-ink">{t("topEmployerTitle")}</h3>
        </div>
        {active && (
          <span className="rounded bg-mint/25 px-2 py-1 text-xs font-semibold text-pine">{t("topEmployerActiveLabel")}</span>
        )}
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-ink">
        {PERK_KEYS.map((key) => (
          <li key={key} className="flex items-start gap-2">
            <span aria-hidden className="text-pine">
              ✓
            </span>
            <span>
              {t(key)}
              {key === "topEmployerPerkApi" && (
                <>
                  {" "}
                  <Link href="/developers" className="whitespace-nowrap text-pine hover:underline">
                    {t("topEmployerPerkApiDocsLink")}
                  </Link>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      {!active && (
        <>
          <div className="mt-5 flex gap-2 rounded-lg bg-paper p-1">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                interval === "month" ? "bg-white text-ink shadow-sm" : "text-muted"
              }`}
            >
              {t("billingMonthly")}
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={`relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                interval === "year" ? "bg-white text-ink shadow-sm" : "text-muted"
              }`}
            >
              {t("billingAnnual")}
              <span className="ml-1.5 rounded bg-mint/25 px-1 py-0.5 text-[10px] font-semibold text-pine">
                {t("billingAnnualSave")}
              </span>
            </button>
          </div>

          <p className="mt-4 font-display text-3xl font-bold text-ink">
            {interval === "month" ? "€585" : "€497"}
            <span className="text-base font-normal text-muted"> {t("perMonth")}</span>
          </p>
          {interval === "year" && <p className="mt-0.5 text-xs text-muted">{t("billingAnnualNote")}</p>}

          <button
            type="button"
            disabled={pending}
            onClick={subscribe}
            className="mt-4 h-10 w-full rounded-lg bg-amber-400 text-sm font-semibold text-ink hover:bg-amber-300 disabled:opacity-50"
          >
            {pending ? t("redirecting") : t("subscribeTopEmployer")}
          </button>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </>
      )}
    </div>
  );
}
