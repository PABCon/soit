"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateJobDisclaimerAction } from "@/app/[locale]/(console)/recruit/team/actions";

/** Moved here from Company Profile per direct instruction: this is a
 *  once-per-team process setting (what gets appended to the bottom of
 *  every job your team posts), not a public-facing profile fact, so it
 *  lives alongside Team rather than in the same form as the logo/
 *  description/socials. */
export function JobDisclaimerSection({ jobDisclaimer: initial }: { jobDisclaimer: string | null }) {
  const t = useTranslations("console");
  const [jobDisclaimer, setJobDisclaimer] = useState(initial ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setPending(true);
    setSaved(false);
    await updateJobDisclaimerAction(jobDisclaimer.trim() || null);
    setPending(false);
    setSaved(true);
  }

  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <h2 className="text-lg font-semibold text-ink">{t("jobDisclaimer")}</h2>
      <p className="mt-1 text-sm text-muted">{t("jobDisclaimerHint")}</p>
      <textarea
        value={jobDisclaimer}
        onChange={(e) => setJobDisclaimer(e.target.value)}
        rows={3}
        placeholder={t("jobDisclaimerPlaceholder")}
        className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="h-9 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine-hover disabled:opacity-50"
        >
          {t("save")}
        </button>
        {saved && <span className="text-sm text-pine">{t("saved")}</span>}
      </div>
    </div>
  );
}
