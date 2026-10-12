"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Briefcase, MapPin, Calendar, Eye, Users, Clock, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Salary } from "@/components/Salary";
import { Badge } from "@/components/Badge";
import { buttonClassName } from "@/components/Button";
import { setJobStatusAction, deleteJobAction } from "@/app/[locale]/(console)/recruit/jobs/actions";
import type { ConsoleJob, ConsoleTab } from "@/lib/db/jobs";

/** Round 22 restyle of the console job-ad row — same underlying actions
 *  (`setJobStatusAction`/`deleteJobAction`), same tab-gating rules as the
 *  prior `JobListRow`, rebuilt into the reference's badge-row / sub-stat-
 *  row / salary+buttons layout. Real data only: `job.viewCount` (a real
 *  counter, round 22) and `job.newApplicantCount` (a real per-job count
 *  of `applications.created_at` in the last 7 days) — no fabricated
 *  numbers anywhere in this row.
 *
 *  Round 23: the `⋮` menu is gone entirely — no real functionality
 *  behind it was worth keeping as a separate menu (its one other item,
 *  "View public listing," had no other home and was dropped along with
 *  it, per direct instruction). Drafts get a direct, always-visible bin
 *  icon instead of a buried menu item — same real `deleteJobAction` +
 *  `window.confirm()` guard as before, just surfaced directly. The
 *  bottom row is now `flex-col sm:flex-row` — at narrow widths Salary
 *  and the button group each get their own full-width line instead of
 *  being squeezed into one row with no wrap, which is what was actually
 *  causing the two to visually overlap. */
export function ConsoleJobRow({ job, tab }: { job: ConsoleJob; tab: ConsoleTab }) {
  const t = useTranslations("console");
  const tjf = useTranslations("jobForm");
  const tf = useTranslations("feed");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ message?: string } | void>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result?.message === "noAdCredits") setError(t("errorNoAdCredits"));
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errorGeneric"));
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(t("confirmDeleteJob"))) return;
    run(() => deleteJobAction(job.id));
  }

  const statusLabel =
    job.status === "published" ? (tab === "active" ? t("statusActive") : t("statusExpired")) : t(`status_${job.status}`);
  const durationMonths = job.salaryPeriod === "month" ? job.salaryMonths : undefined;

  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
          <Briefcase className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <Link href={`/recruit/jobs/${job.id}/edit`} className="truncate font-display font-semibold text-ink hover:text-pine">
            {job.title}
          </Link>

          {/* Round 24: the five pieces here (status/location/type/duration/
           *  posted-date) were orphan-wrapping just the last item at a real,
           *  reproducible desktop width band (~780-850px browser width — a
           *  non-maximized window or a zoomed-in normal monitor, not just
           *  mobile), confirmed via bounding-box measurement: at that width
           *  the combined item+gap width was within single-digit pixels of
           *  the available line width, so a long real location name
           *  ("Viana do Castelo") + a long employment-type label ("Prestação
           *  de serviços") left the trailing "posted X ago" text just short
           *  of fitting, wrapping it alone and leaving a visible empty gap
           *  before the break. Tightened gaps/icon sizes here (icons now
           *  match the row's own text-xs size instead of running a touch
           *  larger) to buy back real width — verified this pushes the
           *  wrap threshold down by ~30px without changing how the row
           *  reads. Genuine narrow widths (mobile/the sidebar's own
           *  stacked layout) still wrap correctly, unchanged. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {job.status === "published" && tab === "active" ? (
              <Badge variant="boosted">{statusLabel}</Badge>
            ) : (
              <span className="rounded-md border border-line bg-white px-1.5 py-0.5 text-xs text-muted">{statusLabel}</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {job.location ?? t("remoteBadge")}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Briefcase className="h-3 w-3" aria-hidden="true" />
              {tjf(`employmentTypeOption.${job.employmentType}`)}
            </span>
            {typeof durationMonths === "number" && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {t("monthsCount", { count: durationMonths })}
              </span>
            )}
            <span className="text-xs text-muted">{tf("postedAgo", { days: job.postedDaysAgo })}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {t("jobViewCount", { count: job.viewCount })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {t("applicantCount", { count: job.applicantCount })}
            </span>
            {job.newApplicantCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-pine">
                <span className="h-1.5 w-1.5 rounded-full bg-pine" aria-hidden="true" />
                {t("jobNewApplicantCount", { count: job.newApplicantCount })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {t("jobNewApplicantCount", { count: 0 })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Round-23 fix: `flex-col sm:flex-row` — at narrow widths Salary and
       *  the button group each get a full-width line of their own (with a
       *  border-top to visually separate them from the content above and
       *  from each other), instead of being forced onto one row with
       *  nothing to wrap into, which is what made them crowd/overlap. */}
      <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
        <Salary
          min={job.salaryMin}
          max={job.salaryMax}
          period={job.salaryPeriod}
          months={job.salaryMonths}
          employmentType={job.employmentType}
        />

        <div className="flex flex-wrap items-center gap-2">
          {tab === "active" && (
            <Link href={`/recruit/jobs/${job.id}/applicants`} className={`relative ${buttonClassName({ size: "md" })}`}>
              {t("viewApplicants")}
              {job.newApplicantCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                  {job.newApplicantCount}
                </span>
              )}
            </Link>
          )}
          <Link href={`/recruit/jobs/${job.id}/edit`} className={buttonClassName({ variant: "secondary", size: "md" })}>
            {t("editButton")}
          </Link>
          {tab === "active" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setJobStatusAction(job.id, "inactive"))}
              className={buttonClassName({ variant: "secondary", size: "md", className: "disabled:opacity-50" })}
            >
              {t("pauseJob")}
            </button>
          )}
          {tab === "inactive" && job.status === "inactive" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setJobStatusAction(job.id, "published"))}
              className={buttonClassName({ variant: "secondary", size: "md", className: "disabled:opacity-50" })}
            >
              {t("reactivateJob")}
            </button>
          )}
          {tab === "drafts" && (
            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              aria-label={t("deleteJob")}
              title={t("deleteJob")}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </li>
  );
}
