"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Crown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  createTopEmployerCheckoutAction,
  createBillingPortalSessionAction,
  type BillingInterval,
} from "@/app/[locale]/(console)/recruit/jobs/ads/actions";
import { buttonClassName } from "@/components/Button";

const PERK_KEYS = [
  "topEmployerPerkBadge",
  "topEmployerPerkPlacement",
  "topEmployerPerkApi",
  "topEmployerPerkBumps",
  "topEmployerPerkProfile",
] as const;

export function TopEmployerCard({
  active,
  periodEnd,
  billingInterval,
}: {
  active: boolean;
  periodEnd: string | null;
  billingInterval?: "month" | "year" | null;
}) {
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

  async function manageBilling() {
    setError(null);
    setPending(true);
    try {
      const result = await createBillingPortalSessionAction(locale);
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
    <div className={`rounded-xl border-2 p-6 ${active ? "border-amber-400 bg-amber-50/40" : "border-amber-400 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Crown className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-wide text-amber-600 uppercase">{t("topEmployerBadgeLabel")}</p>
            <h3 className="font-display text-xl font-bold text-ink">{t("topEmployerTitle")}</h3>
            {active && billingInterval && (
              <p className="mt-1 text-sm font-medium text-ink">
                {billingInterval === "year" ? t("billingAnnual") : t("billingMonthly")}
              </p>
            )}
            {active && periodEnd && (
              <p className="text-sm text-muted">
                {t("topEmployerRenewsOn", { date: new Date(periodEnd).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB") })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {active && <span className="rounded bg-mint/25 px-2 py-1 text-xs font-semibold text-pine">{t("topEmployerActiveLabel")}</span>}
          {active && (
            <button
              type="button"
              disabled={pending}
              onClick={manageBilling}
              className={buttonClassName({ variant: "secondary", className: pending ? "opacity-50" : "" })}
            >
              {pending ? t("redirecting") : t("manageBilling")}
            </button>
          )}
        </div>
      </div>
      {active && error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-ink sm:grid-cols-2">
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
        <div className="mt-5 max-w-xs">
          <div className="flex gap-2 rounded-lg bg-paper p-1">
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
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                interval === "year" ? "bg-white text-ink shadow-sm" : "text-muted"
              }`}
            >
              {t("billingAnnual")}
            </button>
          </div>

          <p className="mt-4 font-display text-3xl font-bold text-ink">
            {interval === "month" ? "€208.33" : "€2500"}
            <span className="text-base font-normal text-muted">
              {" "}
              {interval === "month" ? t("perMonth") : t("perYear")}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">{t("billingSameEitherWay")}</p>

          <button
            type="button"
            disabled={pending}
            onClick={subscribe}
            className="mt-4 h-10 w-full rounded-lg bg-amber-400 text-sm font-semibold text-ink hover:bg-amber-300 disabled:opacity-50"
          >
            {pending ? t("redirecting") : t("subscribeTopEmployer")}
          </button>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
