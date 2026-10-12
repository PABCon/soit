"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { generateApplicantSynopsisAction } from "@/app/[locale]/(console)/recruit/jobs/[id]/applicants/actions";
import type { ApplicantSynopsis } from "@/lib/ai/applicant-synopsis";
import { AiSummaryPanel } from "@/components/AiSummaryPanel";

/** Applicant detail view's "AI summary" (real-usage QA item) —
 *  generated once on an explicit click (see generateApplicantSynopsis()'s
 *  own doc comment for why it's not automatic), cached on the
 *  application row afterward. "Regenerate" re-runs it, e.g. if the
 *  candidate replaced their CV after the first read.
 *
 *  Round 26: now a thin wrapper over the shared `AiSummaryPanel` — the
 *  same visual shape the new matchmaking candidate-profile page uses for
 *  its own AI summary, per the user's explicit ask that the two
 *  "AI summarizes this person's fit" surfaces should read as one
 *  feature, not two independently-styled ones. No behavior change here. */
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

  return (
    <AiSummaryPanel
      heading={t("aiSynopsisHeading")}
      summaryLabel={t("synopsisSummaryLabel")}
      summary={synopsis?.summary ?? null}
      sections={[
        { label: t("synopsisStrengths"), items: synopsis?.strengths ?? [], icon: "plus", toneClassName: "text-pine" },
        { label: t("synopsisGaps"), items: synopsis?.gaps ?? [], icon: "minus", toneClassName: "text-amber-700" },
      ]}
      generateCta={t("synopsisGenerateCta")}
      regenerateCta={t("synopsisRegenerateCta")}
      generatingText={t("synopsisGenerating")}
      pending={pending}
      onGenerate={generate}
      error={error}
    />
  );
}
