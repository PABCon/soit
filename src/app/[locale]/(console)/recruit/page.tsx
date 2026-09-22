import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getCompanyJobs, type ConsoleTab } from "@/lib/db/jobs";
import { Salary } from "@/components/Salary";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS: { key: ConsoleTab; labelKey: string }[] = [
  { key: "active", labelKey: "tabActive" },
  { key: "inactive", labelKey: "tabInactive" },
  { key: "drafts", labelKey: "tabDrafts" },
];

/** Employers land here (§7.2). Tabs per the spec's table: Active
 *  (published + not expired), Inactive (published+expired, paused,
 *  closed), Drafts. No job is ever invisible to its own employer. */
export default async function MyJobAdsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { tab: rawTab } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) {
    return <p className="text-sm text-muted">{t("notEmployer")}</p>;
  }

  const tab: ConsoleTab = rawTab === "inactive" || rawTab === "drafts" ? rawTab : "active";
  const jobs = await getCompanyJobs(ctx.company.id, tab);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("myJobAds")}</h1>
        <Link
          href="/recruit/jobs/new"
          className="flex h-9 items-center rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90"
        >
          {t("addJobAd")}
        </Link>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(({ key, labelKey }) => (
          <Link
            key={key}
            href={{ pathname: "/recruit", query: key === "active" ? {} : { tab: key } }}
            className={
              tab === key
                ? "-mb-px shrink-0 border-b-2 border-pine px-3 py-2 text-sm font-medium whitespace-nowrap text-ink"
                : "shrink-0 px-3 py-2 text-sm whitespace-nowrap text-muted"
            }
          >
            {t(labelKey)}
          </Link>
        ))}
      </div>

      {jobs.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/recruit/jobs/${job.id}/edit`}
                className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{job.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {job.location ?? t("remoteBadge")} ·{" "}
                    {job.status === "published"
                      ? tab === "active"
                        ? t("statusActive")
                        : t("statusExpired")
                      : t(`status_${job.status}`)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Salary
                    min={job.salaryMin}
                    max={job.salaryMax}
                    period={job.salaryPeriod}
                    months={job.salaryMonths}
                    employmentType={job.employmentType}
                  />
                  {tab === "active" && (
                    <p className="mt-1 text-xs text-muted">
                      {t("applicantCount", { count: job.applicantCount })}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
