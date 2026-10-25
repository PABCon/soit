"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, Users } from "lucide-react";
import {
  createAdCreditCheckoutAction,
  createBillingPortalSessionAction,
  type AdCreditPackSize,
} from "@/app/[locale]/(console)/recruit/jobs/ads/actions";
import { buttonClassName } from "@/components/Button";

// §pricing — the reverse-engineered volume curve (anchored on €59 at n=1
// and the real ITDS rate of ~€20/ad at n≈108), rounded to clean checkout
// prices for the four self-serve packs, with the discount vs. buying
// singles clearly labeled — this is the actual incentive to buy more at
// once, and it needs to be visible, not just implied by the math. 6+ is
// deliberately not offered here — that's the "talk to sales" path.
const PACKS: { quantity: AdCreditPackSize; totalEur: number; discountPct: number }[] = [
  { quantity: 1, totalEur: 59, discountPct: 0 },
  { quantity: 2, totalEur: 90, discountPct: 24 },
  { quantity: 3, totalEur: 117, discountPct: 34 },
  { quantity: 5, totalEur: 170, discountPct: 42 },
];

const BEST_VALUE_QUANTITY: AdCreditPackSize = 5;

const INCLUDED_KEYS = [
  "adPackPerkBump",
  "adPackPerkSalary",
  "adPackPerkDuration",
  "adPackPerkFields",
  "adPackPerkEdit",
  "adPackPerkReach",
] as const;

export function AdCreditPacks({
  active,
  slotCap,
  periodEnd,
}: {
  active: boolean;
  slotCap: number;
  periodEnd: string | null;
}) {
  const t = useTranslations("console");
  const locale = useLocale();
  const [pending, setPending] = useState<AdCreditPackSize | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(quantity: AdCreditPackSize) {
    setError(null);
    setPending(quantity);
    try {
      const result = await createAdCreditCheckoutAction(quantity, locale);
      if (result.ok) {
        window.location.assign(result.url);
        return;
      }
      setError(t("errorGeneric"));
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(null);
    }
  }

  async function manageBilling() {
    setError(null);
    setPending("portal");
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
      setPending(null);
    }
  }

  // An active plan already has a real Stripe subscription — a second
  // purchase here would create a second, concurrent one instead of
  // upgrading in place, so the buy grid is replaced with a status card and
  // a link to the real place to change or cancel a plan: Stripe's own
  // Customer Portal, same pattern TopEmployerCard already uses.
  if (active) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-pine bg-pine/5 p-5">
        <div>
          <span className="rounded bg-mint/25 px-2 py-1 text-xs font-semibold text-pine">{t("jobAdsPlanActiveLabel")}</span>
          <p className="mt-2 font-display text-2xl font-bold text-ink">{t("adCreditsRemaining", { count: slotCap })}</p>
          {periodEnd && (
            <p className="mt-1 text-sm text-muted">
              {t("topEmployerRenewsOn", { date: new Date(periodEnd).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB") })}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={pending !== null}
          onClick={manageBilling}
          className={buttonClassName({ variant: "secondary", className: pending ? "opacity-50" : "" })}
        >
          {pending === "portal" ? t("redirecting") : t("manageBilling")}
        </button>
        {error && <p className="w-full text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-paper/60 p-5 text-center">
          <p className="text-sm text-muted">{t("freeTierLabel")}</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink">{t("freeTierPrice")}</p>
          <p className="mt-1 text-xs text-muted">{t("freeTierCaption")}</p>
          <Link href="/recruit/jobs/new" className={buttonClassName({ variant: "secondary", size: "md", className: "mt-4 w-full" })}>
            {t("freeTierGetStarted")}
          </Link>
        </div>
        {PACKS.map((pack) => {
          const isBestValue = pack.quantity === BEST_VALUE_QUANTITY;
          return (
            <div
              key={pack.quantity}
              className={`relative flex flex-col items-center rounded-xl border bg-white p-5 text-center ${
                isBestValue ? "border-2 border-pine" : "border-line"
              }`}
            >
              {isBestValue && (
                <span className="absolute -top-3 right-3 rounded bg-ink px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                  {t("bestValueBadge")}
                </span>
              )}
              {pack.discountPct > 0 && (
                <span className="absolute top-3 right-3 rounded bg-mint/25 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-pine uppercase">
                  −{pack.discountPct}%
                </span>
              )}
              <p className="text-sm text-muted">{t("adPackLabel", { count: pack.quantity })}</p>
              <p className="mt-2 font-display text-2xl font-bold text-ink">
                €{pack.totalEur}
                <span className="text-sm font-normal text-muted"> {t("perMonth")}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                €{(pack.totalEur / pack.quantity).toFixed(0)} {t("perAd")} · {t("billedMonthly")}
              </p>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => buy(pack.quantity)}
                className="mt-4 h-9 w-full rounded-lg bg-pine text-sm font-semibold text-white hover:bg-pine/90 disabled:opacity-50"
              >
                {pending === pack.quantity ? t("redirecting") : t("buyPack")}
              </button>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-subtle p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-ink">{t("needMoreTitle")}</p>
            <p className="text-sm text-muted">{t("needMoreSubtitle")}</p>
          </div>
        </div>
        <Link href="/recruit/contact" className={buttonClassName({ variant: "secondary" })}>
          {t("contactSales")}
        </Link>
      </div>

      {/* Always visible, matching the reference — every pack includes the
       *  exact same perks, so this is one shared card, not repeated per
       *  pack or hidden behind a disclosure toggle. */}
      <div id="whats-included" className="mt-4 rounded-xl border border-line bg-white p-4">
        <p className="font-semibold text-ink">{t("adPackWhatsIncluded")}</p>
        <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-ink sm:grid-cols-2">
          {INCLUDED_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pine" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
