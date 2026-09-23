"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Salary } from "@/components/Salary";
import { setJobStatusAction, deleteJobAction } from "@/app/[locale]/(console)/recruit/jobs/actions";
import type { ConsoleJob, ConsoleTab } from "@/lib/db/jobs";

export function JobListRow({ job, tab }: { job: ConsoleJob; tab: ConsoleTab }) {
  const t = useTranslations("console");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(t("confirmDeleteJob"))) return;
    run(() => deleteJobAction(job.id));
  }

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/recruit/jobs/${job.id}/edit`} className="min-w-0 flex-1 hover:opacity-80">
          <p className="truncate font-medium text-ink">{job.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            {job.location ?? t("remoteBadge")} ·{" "}
            {job.status === "published"
              ? tab === "active"
                ? t("statusActive")
                : t("statusExpired")
              : t(`status_${job.status}`)}
          </p>
        </Link>

        <div className="shrink-0 text-right">
          <Salary
            min={job.salaryMin}
            max={job.salaryMax}
            period={job.salaryPeriod}
            months={job.salaryMonths}
            employmentType={job.employmentType}
          />
          {tab === "active" && (
            <Link
              href={`/recruit/jobs/${job.id}/applicants`}
              className="mt-1 block text-xs text-pine hover:underline"
            >
              {t("applicantCount", { count: job.applicantCount })}
            </Link>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {tab === "active" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setJobStatusAction(job.id, "inactive"))}
              className="text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
            >
              {t("pauseJob")}
            </button>
          )}
          {tab === "inactive" && job.status === "inactive" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setJobStatusAction(job.id, "published"))}
              className="text-xs font-medium text-pine hover:underline disabled:opacity-50"
            >
              {t("reactivateJob")}
            </button>
          )}
          {tab === "drafts" && (
            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
            >
              {t("deleteJob")}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </li>
  );
}
