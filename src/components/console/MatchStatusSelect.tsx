"use client";

import { useTranslations } from "next-intl";
import { setMatchStatusAction } from "@/app/[locale]/(console)/recruit/matchmaking/[jobId]/actions";
import type { MatchStatus } from "@/lib/db/candidate-matches";

const STATUSES: MatchStatus[] = ["new", "shortlisted", "contacted", "passed"];

/** Round 26 — a status concept scoped specifically to blinded matches
 *  (company_id + job_id + candidate_id → status), deliberately separate
 *  from `applications.status` (see `candidate_match_notes`'s own
 *  migration comment: a match has no application record to attach a
 *  status to). Same `defaultValue` + plain `<select>` idiom as
 *  `ApplicantStatusSelect`. */
export function MatchStatusSelect({
  jobId,
  candidateId,
  initialStatus,
}: {
  jobId: string;
  candidateId: string;
  initialStatus: MatchStatus;
}) {
  const t = useTranslations("console");

  return (
    <select
      defaultValue={initialStatus}
      onChange={(e) => setMatchStatusAction(jobId, candidateId, e.target.value as MatchStatus)}
      className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`matchStatusOption.${s}`)}
        </option>
      ))}
    </select>
  );
}
