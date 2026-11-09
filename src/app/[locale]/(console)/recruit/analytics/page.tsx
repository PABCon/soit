import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eye, MousePointerClick, FileCheck2 } from "lucide-react";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getCompanyAnalytics } from "@/lib/db/job-analytics";
import { AnalyticsTrendChart } from "@/components/console/AnalyticsTrendChart";

type Props = { params: Promise<{ locale: string }> };

/** Employer analytics, phase 1 — real numbers already sitting in the
 *  database (job views, apply-button clicks, completed applications),
 *  surfaced as a real dashboard with a 30-day trend instead of left as
 *  a bare per-row counter on the job list. Deliberately scoped to what's
 *  already instrumented: no company-profile-page views, no unique/
 *  returning-visitor split, no followers or reviews — each of those
 *  needs its own new tracking infrastructure (or, for reviews/followers,
 *  is really a separate product feature, not an analytics addition) and
 *  is its own later phase, not bundled in here. */
export default async function AnalyticsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "analytics" });
  const tc = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{tc("notEmployer")}</p>;

  const analytics = await getCompanyAnalytics(ctx.company.id);

  const statCards = [
    { key: "totalViews", value: analytics.totals.views, Icon: Eye },
    { key: "totalApplyClicks", value: analytics.totals.applyClicks, Icon: MousePointerClick },
    { key: "totalApplications", value: analytics.totals.applications, Icon: FileCheck2 },
  ] as const;

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.key} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
              <card.Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-bold text-ink">{card.value}</p>
              <p className="truncate text-xs text-muted">{t(`stat.${card.key}`)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-semibold text-ink">{t("trendHeading")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t("trendSubtitle")}</p>
        <div className="mt-4">
          <AnalyticsTrendChart trend={analytics.trend} viewsLabel={t("stat.totalViews")} applyClicksLabel={t("stat.totalApplyClicks")} />
        </div>
      </div>

      {analytics.jobs.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <th className="px-4 py-3">{t("columnJob")}</th>
                <th className="px-4 py-3">{t("columnViews")}</th>
                <th className="px-4 py-3">{t("columnApplyClicks")}</th>
                <th className="px-4 py-3">{t("columnApplications")}</th>
                <th className="px-4 py-3">{t("columnConversion")}</th>
              </tr>
            </thead>
            <tbody>
              {analytics.jobs.map((job) => {
                const conversion = job.views > 0 ? Math.round((job.applications / job.views) * 1000) / 10 : null;
                return (
                  <tr key={job.jobId} className="border-b border-line last:border-0">
                    <td className="max-w-xs truncate px-4 py-3 font-medium text-ink">{job.jobTitle}</td>
                    <td className="px-4 py-3 text-ink">{job.views}</td>
                    <td className="px-4 py-3 text-ink">{job.applyClicks}</td>
                    <td className="px-4 py-3 text-ink">{job.applications}</td>
                    <td className="px-4 py-3 text-ink">{conversion != null ? `${conversion}%` : t("noData")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
