"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { updateStatusAction, startApplicantThreadAction } from "@/app/[locale]/(console)/recruit/jobs/[id]/applicants/actions";
import { StartThreadButton } from "@/components/StartThreadButton";
import type { Applicant, MyApplication } from "@/lib/db/applications";

const STATUSES: MyApplication["status"][] = ["applied", "viewed", "responded", "rejected", "closed"];

export function ApplicantsList({ jobId, applicants }: { jobId: string; applicants: Applicant[] }) {
  const t = useTranslations("applicants");

  async function handleStatusChange(applicationId: string, status: MyApplication["status"]) {
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
            <p className="text-sm text-muted">{a.candidateEmail}</p>
            {a.coverNote && <p className="mt-1 text-sm text-muted">{a.coverNote}</p>}
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
          <StartThreadButton
            redirectBase="/recruit/messages"
            onSend={(body) => startApplicantThreadAction(a.id, body)}
          />
          <select
            defaultValue={a.status}
            onChange={(e) => handleStatusChange(a.id, e.target.value as MyApplication["status"])}
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
