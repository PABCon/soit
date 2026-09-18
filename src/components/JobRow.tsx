import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Salary } from "@/components/Salary";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TechTags } from "@/components/TechTags";
import type { Job } from "@/lib/jobs";

/**
 * One row of the feed — the hero of the product (§11).
 * Hairline-separated, but carrying the density that makes a job board usable:
 * logo, title, company, location, work model, stack, and the salary as the
 * one bold element.
 */
export function JobRow({ job }: { job: Job }) {
  const t = useTranslations("feed");
  const isNew = job.postedDaysAgo <= 2;

  return (
    <li className="group @container border-b border-line">
      <Link
        href={`/jobs/${job.slug}`}
        className="flex flex-col gap-2 px-3 py-4 transition-colors hover:bg-white @2xl:flex-row @2xl:items-center @2xl:gap-4"
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <CompanyLogo company={job.company} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="font-display text-[15px] font-semibold text-ink group-hover:text-pine">
                {job.title}
              </h2>
              {isNew && (
                <span className="rounded bg-mint/25 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-pine uppercase">
                  {t("new")}
                </span>
              )}
              <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted uppercase">
                {job.language}
              </span>
            </div>

            <p className="mt-0.5 truncate text-sm text-muted">
              {job.company.name} · {job.location ?? t("remote")} ·{" "}
              {t(`workModel.${job.workModel}`)} · {t(`seniority.${job.seniority}`)}
            </p>

            <div className="mt-2">
              <TechTags tech={job.tech} max={4} />
            </div>
          </div>
        </div>

        <div className="shrink-0 pl-16 text-left @2xl:pl-0 @2xl:text-right">
          <Salary
            min={job.salaryMin}
            max={job.salaryMax}
            period={job.salaryPeriod}
            months={job.salaryMonths}
            employmentType={job.employmentType}
          />
          <p className="mt-1 text-xs text-muted/70">
            {t("postedAgo", { days: job.postedDaysAgo })}
          </p>
        </div>
      </Link>
    </li>
  );
}
