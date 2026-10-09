"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateMarketingOptInAction } from "@/app/[locale]/(candidate)/settings/actions";

/** Candidate settings — marketing-preferences checkbox (real-usage QA
 *  item). Saves on toggle, same "no separate Save button" pattern as
 *  other single-field settings in this app (e.g. CvOnboardingPrompt's
 *  dismiss). */
export function MarketingOptInToggle({ initialOptIn }: { initialOptIn: boolean }) {
  const t = useTranslations("settings");
  const [optIn, setOptIn] = useState(initialOptIn);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !optIn;
    setOptIn(next);
    setPending(true);
    try {
      await updateMarketingOptInAction(next);
    } catch {
      setOptIn(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="flex max-w-sm items-start gap-3 text-sm text-ink">
      <input
        type="checkbox"
        checked={optIn}
        disabled={pending}
        onChange={toggle}
        className="mt-0.5 h-4 w-4 rounded border-line text-pine focus:ring-pine"
      />
      <span>
        {t("marketingOptIn")}
        <span className="block text-xs text-muted">{t("marketingOptInHint")}</span>
      </span>
    </label>
  );
}
