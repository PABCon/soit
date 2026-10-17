"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { regenerateMatchSummaryAction } from "@/app/[locale]/(console)/recruit/matchmaking/[jobId]/actions";
import type { MatchSummary } from "@/lib/ai/match-summary";
import { AiSummaryPanel } from "@/components/AiSummaryPanel";

/** Matchmaking candidate-profile page's "AI summary" panel — same shared
 *  `AiSummaryPanel` shape the applicant detail view's own synopsis uses
 *  (round 26's explicit visual-consistency ask), different content
 *  underneath: `generateMatchSummaries`/`generateSingleMatchSummary`'s
 *  privacy-constrained output (never a real name, employer, or school —
 *  see match-summary.ts's own doc comment), not `generateApplicantSynopsis`'s. */
export function MatchSummarySection({
  jobId,
  candidateId,
  initialSummary,
}: {
  jobId: string;
  candidateId: string;
  initialSummary: MatchSummary | null;
}) {
  const t = useTranslations("console");
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateMatchSummaryAction(jobId, candidateId);
      if (!result.ok) {
        setError(t("matchSummaryError"));
        return;
      }
      setSummary(result.data);
      router.refresh();
    });
  }

  return (
    <AiSummaryPanel
      heading={t("aiSummaryHeading")}
      icon={FileText}
      summaryLabel={t("profileSummaryLabel")}
      summary={summary?.summary ?? null}
      sections={[
        { label: t("keyStrengthsLabel"), items: summary?.strengths ?? [], icon: "plus", toneClassName: "text-pine" },
      ]}
      generateCta={t("aiSummaryGenerateCta")}
      regenerateCta={t("aiSummaryRegenerateCta")}
      generatingText={t("aiSummaryGenerating")}
      pending={pending}
      onGenerate={generate}
      error={error}
    />
  );
}
