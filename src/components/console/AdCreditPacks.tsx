"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createAdCreditCheckoutAction, type AdCreditPackSize } from "@/app/[locale]/(console)/recruit/jobs/ads/actions";

// §pricing — the reverse-engineered volume curve (anchored on €59 at n=1
// and the real ITDS rate of ~€20/ad at n≈108), rounded to clean checkout
// prices for the four self-serve packs. 6+ is deliberately not offered
// here — that's the "talk to sales" path, not a self-serve amount.
const PACKS: { quantity: AdCreditPackSize; totalEur: number }[] = [
  { quantity: 1, totalEur: 59 },
  { quantity: 2, totalEur: 90 },
  { quantity: 3, totalEur: 117 },
  { quantity: 5, totalEur: 170 },
];

export function AdCreditPacks() {
  const t = useTranslations("console");
  const [pending, setPending] = useState<AdCreditPackSize | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(quantity: AdCreditPackSize) {
    setError(null);
    setPending(quantity);
    try {
      const result = await createAdCreditCheckoutAction(quantity);
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PACKS.map((pack) => (
          <div key={pack.quantity} className="rounded-xl border border-line bg-white p-5 text-center">
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
      <p className="mt-4 text-sm text-muted">{t("talkToSales")}</p>
    </div>
  );
}
