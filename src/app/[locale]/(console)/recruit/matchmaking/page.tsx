import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { Crown, Lock, Briefcase, Users as UsersIcon, BarChart3 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getCompanyJobs } from "@/lib/db/jobs";
import { getMatchCountsForCompanyJobs } from "@/lib/db/candidate-matches";
import { buttonClassName } from "@/components/Button";

type Props = { params: Promise<{ locale: string }> };

/** §AI Pieces backlog, item 3 — mirrors page 3 of the justjoin.it
 *  "Matchmaking Beta" reference: the employer's live job ads, each
 *  showing its live match count, linking into the per-job blinded list.
 *  Matching is a paying-customer perk (any paid ad credit or Top
 *  Employer) — a non-paying company sees the upsell, not a fake
 *  zero-match list.
 *
 *  Round 26 restyle, per the 4-reference-image design: the locked state
 *  (01) gets the crown/lock upsell card with its 3 feature bullets; the
 *  unlocked overview (02) gets a per-job icon card, a real "last
 *  checked" date (see getMatchCountsForCompanyJobs' own comment for what
 *  that actually maps to — genuine employer activity on that job's
 *  matches, not a fabricated "viewed" timestamp this feature doesn't
 *  track), and a "Top Employer active" badge gated on the real
 *  subscription flag specifically, not just any paying-customer status. */
export default async function MatchmakingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });
  const tJobForm = await getTranslations({ locale, namespace: "jobForm" });
  const format = await getFormatter({ locale });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{t("notEmployer")}</p>;

  const isPayingCustomer = ctx.company.job_ad_slot_cap > 1 || ctx.company.top_employer_active;

  if (!isPayingCustomer) {
    return (
      <>
        <h1 className="text-3xl font-bold lg:text-4xl">{t("matchmaking")}</h1>
        <p className="mt-1 text-sm text-muted">{t("matchmakingSubtitle")}</p>

        <div className="mt-6 rounded-xl border border-line bg-white p-10 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning px-3 py-1 text-xs font-semibold tracking-wide text-amber-900 uppercase">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            {t("topEmployerRequired")}
          </span>

          <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-pine/10">
            <Lock className="h-7 w-7 text-pine" aria-hidden="true" />
          </div>

          <h2 className="mt-4 font-display text-xl font-bold text-ink">{t("matchmakingLockedHeading")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("matchmakingLockedSubtext")}</p>

          <div className="mx-auto mt-8 grid max-w-2xl gap-6 text-left sm:grid-cols-3">
            {(
              [
                { Icon: Briefcase, titleKey: "matchmakingFeature1Title", bodyKey: "matchmakingFeature1Body" },
                { Icon: UsersIcon, titleKey: "matchmakingFeature2Title", bodyKey: "matchmakingFeature2Body" },
                { Icon: BarChart3, titleKey: "matchmakingFeature3Title", bodyKey: "matchmakingFeature3Body" },
              ] as const
            ).map(({ Icon, titleKey, bodyKey }) => (
              <div key={titleKey} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{t(titleKey)}</p>
                  <p className="mt-0.5 text-xs text-muted">{t(bodyKey)}</p>
                </div>
              </div>
            ))}
          </div>

          <Link href="/recruit/jobs/ads" className={`mt-8 inline-flex ${buttonClassName({ size: "lg" })}`}>
            {t("matchmakingExploreCta")}
          </Link>
          <div className="mt-3">
            <Link href="/recruit/jobs/ads" className="text-sm font-medium text-pine hover:underline">
              {t("pricing")}
            </Link>
          </div>
        </div>
      </>
    );
  }

  const [jobs, counts] = await Promise.all([getCompanyJobs(ctx.company.id, "active"), getMatchCountsForCompanyJobs()]);
  const countByJob = new Map(counts.map((c) => [c.jobId, c]));

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold lg:text-4xl">{t("matchmaking")}</h1>
          <p className="mt-1 text-sm text-muted">{t("matchmakingSubtitle")}</p>
        </div>
        {ctx.company.top_employer_active && (
          // Deliberately not the shared `Badge` "boosted" variant — this
          // project's own "mint" token is a pale *purple* (see globals.css's
          // own comment on the name/color mismatch), but the reference
          // design for this specific badge is genuinely green; matched to
          // what the image actually shows rather than forced into the
          // nearest existing variant.
          <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            {t("topEmployerActiveBadge")}
          </span>
        )}
      </div>

      {jobs.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {jobs.map((job) => {
            const info = countByJob.get(job.id);
            const count = info?.matchCount ?? 0;
            return (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
                    <Briefcase className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-ink">{job.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {job.location ?? t("remoteBadge")} · {tJobForm(`employmentTypeOption.${job.employmentType}`)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {info?.lastCheckedAt
                        ? t("lastChecked", { date: format.dateTime(new Date(info.lastCheckedAt), { dateStyle: "short" }) })
                        : t("neverReviewed")}
                    </p>
                  </div>
                </div>
                {count > 0 ? (
                  <Link href={`/recruit/matchmaking/${job.id}`} className={buttonClassName({ size: "md" })}>
                    {t("viewMatches")}
                  </Link>
                ) : (
                  <span className="shrink-0 text-sm text-muted">{t("noMatchesYetShort")}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
