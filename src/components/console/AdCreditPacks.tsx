"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createAdCreditCheckoutAction, type AdCreditPackSize } from "@/app/[locale]/(console)/recruit/jobs/ads/actions";

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

export function AdCreditPacks() {
  const t = useTranslations("console");
  const locale = useLocale();
  const [pending, setPending] = useState<AdCreditPackSize | null>(null);
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

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-paper/60 p-5 text-center">
          <p className="text-sm text-muted">{t("freeTierLabel")}</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink">{t("freeTierPrice")}</p>
          <p className="mt-1 text-xs text-muted">{t("freeTierCaption")}</p>
        </div>
        {PACKS.map((pack) => (
          <div key={pack.quantity} className="relative flex flex-col items-center rounded-xl border border-line bg-white p-5 text-center">
            {pack.discountPct > 0 && (
              <span className="absolute top-3 right-3 rounded bg-mint/25 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-pine uppercase">
                −{pack.discountPct}%
              </span>
            )}
            <p className="text-sm text-muted">{t("adPackLabel", { count: pack.quantity })}</p>
            <p className="mt-2 font-display text-2xl font-bold text-ink">€{pack.totalEur}</p>
            <p className="mt-1 text-xs text-muted">
              €{(pack.totalEur / pack.quantity).toFixed(0)} {t("perAd")}
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
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {/* One shared explanation, not repeated per card — every pack
       *  includes the exact same three things, so saying it four times
       *  was noise, not information. */}
      <details className="mt-4 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-pine">{t("adPackWhatsIncluded")}</summary>
        <ul className="mt-2 space-y-1 pl-1">
          <li>{t("adPackPerkBump")}</li>
          <li>{t("adPackPerkSalary")}</li>
          <li>{t("adPackPerkDuration")}</li>
        </ul>
      </details>

      <p className="mt-3 text-sm text-muted">
        {t("talkToSales")} <Link href="/recruit/contact" className="font-medium text-pine hover:underline">{t("contactUs")}</Link>
      </p>
    </div>
  );
}
