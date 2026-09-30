import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getCompanyJobs } from "@/lib/db/jobs";
import { getMatchCountsForCompanyJobs } from "@/lib/db/candidate-matches";

type Props = { params: Promise<{ locale: string }> };

/** §AI Pieces backlog, item 3 — mirrors page 3 of the justjoin.it
 *  "Matchmaking Beta" reference: the employer's live job ads, each
 *  showing its live match count, linking into the per-job blinded list.
 *  Matching is a paying-customer perk (any paid ad credit or Top
 *  Employer) — a non-paying company sees the upsell, not a fake
 *  zero-match list. */
export default async function MatchmakingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{t("notEmployer")}</p>;

  const isPayingCustomer = ctx.company.ad_credits_available > 0 || ctx.company.top_employer_active;

  if (!isPayingCustomer) {
    return (
      <>
        <h1 className="text-2xl font-bold">{t("matchmaking")}</h1>
        <div className="mt-6 max-w-lg rounded-xl border border-line bg-paper/60 p-6 text-center">
          <p className="text-sm text-ink">{t("matchmakingUpsell")}</p>
          <Link
            href="/recruit/jobs/ads"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-pine px-5 text-sm font-semibold text-white hover:bg-pine/90"
          >
            {t("pricing")}
          </Link>
        </div>
      </>
    );
  }

  const [jobs, counts] = await Promise.all([getCompanyJobs(ctx.company.id, "active"), getMatchCountsForCompanyJobs()]);
  const countByJob = new Map(counts.map((c) => [c.jobId, c.matchCount]));

  return (
    <>
      <h1 className="text-2xl font-bold">{t("matchmaking")}</h1>
      <p className="mt-1 text-sm text-muted">{t("matchmakingSubtitle")}</p>

      {jobs.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {jobs.map((job) => {
            const count = countByJob.get(job.id) ?? 0;
            return (
              <li key={job.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{job.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{job.location ?? t("remoteBadge")}</p>
                </div>
                <Link
                  href={`/recruit/matchmaking/${job.id}`}
                  className={
                    count > 0
                      ? "shrink-0 rounded-full bg-pine/10 px-3 py-1.5 text-sm font-semibold text-pine hover:bg-pine/20"
                      : "shrink-0 rounded-full bg-paper px-3 py-1.5 text-sm text-muted hover:bg-line/40"
                  }
                >
                  {t("matchCount", { count })}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
