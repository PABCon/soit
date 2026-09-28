"use client";

import { useTranslations } from "next-intl";
import { updateStatusAction } from "@/app/[locale]/(console)/recruit/jobs/[id]/applicants/actions";
import type { MyApplication } from "@/lib/db/applications";

const STATUSES: MyApplication["status"][] = ["applied", "viewed", "responded", "rejected", "closed"];

/** The status control on the candidate detail page — same
 *  `updateStatusAction` the list rows already use, just standalone so the
 *  detail page itself can stay a server component. */
export function ApplicantStatusSelect({
  jobId,
  applicationId,
  initialStatus,
}: {
  jobId: string;
  applicationId: string;
  initialStatus: MyApplication["status"];
}) {
  const t = useTranslations("applicants");

  return (
    <select
      defaultValue={initialStatus}
      onChange={(e) => updateStatusAction(jobId, applicationId, e.target.value as MyApplication["status"])}
      className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`status.${s}`)}
        </option>
      ))}
    </select>
  );
}
