"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { updateStatusAction } from "@/app/[locale]/(console)/recruit/jobs/[id]/applicants/actions";
import type { CompanyApplicant, MyApplication } from "@/lib/db/applications";

const STATUSES: MyApplication["status"][] = ["applied", "viewed", "responded", "rejected", "closed"];

/** Item 2 (§7.2 review) — applicants across every one of the employer's
 *  jobs, not just one at a time. Same row shape as `ApplicantsList`, plus
 *  which job each application is for. */
export function AllApplicantsList({ applicants }: { applicants: CompanyApplicant[] }) {
  const t = useTranslations("applicants");

  async function handleStatusChange(jobId: string, applicationId: string, status: MyApplication["status"]) {
    await updateStatusAction(jobId, applicationId, status);
  }

  if (applicants.length === 0) {
    return <p className="mt-8 text-sm text-muted">{t("empty")}</p>;
  }

  return (
    <ul className="mt-6 divide-y divide-line border-t border-line">
      {applicants.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-4 py-4">
          <div className="min-w-0 flex-1">
            <Link href={`/recruit/applicants/${a.id}`} className="font-medium text-ink hover:text-pine hover:underline">
              {a.candidateName}
            </Link>
            <p className="text-sm text-muted">{t("appliedFor", { job: a.jobTitle })}</p>
          </div>
          {a.cvSignedUrl ? (
            <a
              href={a.cvSignedUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-sm font-medium text-pine hover:underline"
            >
              {t("viewCv")}
            </a>
          ) : (
            <span className="shrink-0 text-sm text-muted">{t("cvUnavailable")}</span>
          )}
          <select
            defaultValue={a.status}
            onChange={(e) => handleStatusChange(a.jobId, a.id, e.target.value as MyApplication["status"])}
            className="h-9 shrink-0 rounded-lg border border-line bg-white px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  );
}
