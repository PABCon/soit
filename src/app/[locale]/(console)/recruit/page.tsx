import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getCompanyJobs, getEmployerDashboardStats, getJobTabCounts, type ConsoleTab } from "@/lib/db/jobs";
import { DashboardStats } from "@/components/console/DashboardStats";
import { NewApplicantsBanner } from "@/components/console/NewApplicantsBanner";
import { ConsoleJobsExplorer } from "@/components/console/ConsoleJobsExplorer";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

/** Employers land here (§7.2). Tabs per the spec's table: Active
 *  (published + not expired), Inactive (published+expired, paused,
 *  closed), Drafts. No job is ever invisible to its own employer.
 *
 *  Round 22 restyle: heading/subtitle/stat-strip/banner/toolbar/row
 *  layout all rebuilt per the reference design — same real data and
 *  server actions underneath (`getCompanyJobs`, `getEmployerDashboardStats`,
 *  `setJobStatusAction`/`deleteJobAction` via `ConsoleJobRow`), nothing
 *  fabricated. Tab counts now come from a dedicated query
 *  (`getJobTabCounts`) so all three tabs show their real count at once,
 *  not just the currently-selected one. */
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
  const [jobs, stats, tabCounts] = await Promise.all([
    getCompanyJobs(ctx.company.id, tab),
    getEmployerDashboardStats(ctx.company.id),
    getJobTabCounts(ctx.company.id),
  ]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold lg:text-4xl">{t("myJobAds")}</h1>
          <p className="mt-1 text-sm text-muted">{t("myJobAdsSubtitle")}</p>
        </div>
        <Link
          href="/recruit/jobs/new"
          className="flex h-11 shrink-0 items-center rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90"
        >
          {t("addJobAd")}
        </Link>
      </div>

      <div className="mt-6">
        <DashboardStats stats={stats} locale={locale} />
      </div>

      <NewApplicantsBanner count={stats.newApplicantsLast7Days} />

      <ConsoleJobsExplorer jobs={jobs} tab={tab} tabCounts={tabCounts} />
    </>
  );
}
