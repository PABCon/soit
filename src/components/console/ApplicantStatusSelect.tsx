"use client";

import { updateStageAction } from "@/app/[locale]/(console)/recruit/jobs/[id]/applicants/actions";
import type { ApplicationStage } from "@/lib/db/application-stages";

/** The stage control on the candidate detail page, using the same
 *  `updateStageAction` the list rows already use, just standalone so the
 *  detail page itself can stay a server component. `stages` is the
 *  company's own custom pipeline (fetched by the page, lazily created
 *  via `getOrCreateCompanyStages` if this company has never customized
 *  one), not a fixed list: every option here is whatever label the
 *  employer themselves chose. */
export function ApplicantStatusSelect({
  jobId,
  applicationId,
  stages,
  initialStageId,
}: {
  jobId: string;
  applicationId: string;
  stages: ApplicationStage[];
  initialStageId: string;
}) {
  return (
    <select
      defaultValue={initialStageId}
      onChange={(e) => updateStageAction(jobId, applicationId, e.target.value)}
      className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
    >
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
