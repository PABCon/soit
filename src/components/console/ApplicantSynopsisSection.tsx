"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { generateApplicantSynopsisAction } from "@/app/[locale]/(console)/recruit/jobs/[id]/applicants/actions";
import type { ApplicantSynopsis } from "@/lib/ai/applicant-synopsis";

/** Applicant detail view's "AI summary" (real-usage QA item) —
 *  generated once on an explicit click (see generateApplicantSynopsis()'s
 *  own doc comment for why it's not automatic), cached on the
 *  application row afterward. "Regenerate" re-runs it, e.g. if the
 *  candidate replaced their CV after the first read. */
export function ApplicantSynopsisSection({
  applicationId,
  initialSynopsis,
}: {
  applicationId: string;
  initialSynopsis: ApplicantSynopsis | null;
}) {
  const t = useTranslations("applicants");
  const router = useRouter();
  const [synopsis, setSynopsis] = useState(initialSynopsis);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateApplicantSynopsisAction(applicationId);
      if (!result.ok) {
        setError(t(`synopsisError.${result.reason}`));
        return;
      }
      setSynopsis(result.data);
      router.refresh();
    });
  }

  if (!synopsis) {
    return (
      <section>
        <h2 className="font-display text-sm font-semibold text-muted">{t("aiSynopsisHeading")}</h2>
        <button
          type="button"
          disabled={pending}
          onClick={generate}
          className="mt-2 flex h-9 items-center rounded-lg border border-pine px-3 text-sm font-medium text-pine hover:bg-pine/5 disabled:opacity-50"
        >
          {pending ? t("synopsisGenerating") : t("synopsisGenerateCta")}
        </button>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-sm font-semibold text-muted">{t("aiSynopsisHeading")}</h2>
        <button
          type="button"
          disabled={pending}
          onClick={generate}
          className="text-xs font-medium text-pine hover:underline disabled:opacity-50"
        >
          {pending ? t("synopsisGenerating") : t("synopsisRegenerateCta")}
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink">{synopsis.summary}</p>

      {synopsis.strengths.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-pine uppercase">{t("synopsisStrengths")}</p>
          <ul className="mt-1 space-y-1">
            {synopsis.strengths.map((point, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-ink">
                <span aria-hidden className="text-pine">
                  +
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {synopsis.gaps.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-amber-700 uppercase">{t("synopsisGaps")}</p>
          <ul className="mt-1 space-y-1">
            {synopsis.gaps.map((point, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-ink">
                <span aria-hidden className="text-amber-600">
                  −
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
