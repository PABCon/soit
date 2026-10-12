import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Salary } from "@/components/Salary";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Badge } from "@/components/Badge";
import type { Job } from "@/lib/types";

/** Round-16 — a dedicated compact row for narrow contexts (the job-detail
 *  page's "Similar jobs" sidebar box). The full `JobRow` is built for the
 *  main feed's much wider column and wraps badly once squeezed into a
 *  ~1/3-width sidebar (confirmed live, not assumed) — this trades full
 *  tech-tag/metadata display for a tight, single-glance summary: logo +
 *  truncated title/meta on the left, salary + posted-ago on the right,
 *  matching the reference's own compact "Similar jobs" list treatment. */
export function CompactJobRow({ job }: { job: Job }) {
  const t = useTranslations("feed");
  const isNew = job.postedDaysAgo <= 2;
  // Round 16 — the reference's own compact rows show exactly one badge per
  // row, not a stacked pile; a narrow ~1/3-width column has too little
  // horizontal room for all three at once without wrapping onto their own
  // lines (confirmed live, not assumed), which is exactly the "shouldn't
  // wrap" complaint this component exists to fix. Same priority order
  // `JobRow` already implies by rendering top-employer/boosted first.
  const badge = job.isTopEmployer
    ? { variant: "topEmployer" as const, label: t("topEmployer") }
    : job.isBoosted
      ? { variant: "boosted" as const, label: t("boosted") }
      : isNew
        ? { variant: "new" as const, label: t("new") }
        : null;

  return (
    <Link
      href={`/jobs/${job.slug}`}
      className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0 hover:bg-subtle"
    >
      <div className="flex min-w-0 items-start gap-2">
        <CompanyLogo company={job.company} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
          <p className="truncate text-xs text-muted">
            {job.company.name} · {job.location ?? t("remote")} · {t(`workModel.${job.workModel}`)}
          </p>
          {badge && (
            <div className="mt-1">
              <Badge variant={badge.variant} size="sm" className="whitespace-nowrap">{badge.label}</Badge>
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Salary
          min={job.salaryMin}
          max={job.salaryMax}
          period={job.salaryPeriod}
          months={job.salaryMonths}
          employmentType={job.employmentType}
          size="feed"
        />
      </div>
    </Link>
  );
}
