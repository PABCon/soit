import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Briefcase } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCandidateMatchesForJob } from "@/lib/db/candidate-matches";
import { getJobForEdit } from "@/lib/db/jobs";
import { MatchesExplorer } from "@/components/console/MatchesExplorer";
import { buttonClassName } from "@/components/Button";

type Props = { params: Promise<{ locale: string; jobId: string }> };

/** Round 26 restyle (page 03 reference): breadcrumb + a job header card,
 *  a client-side sort/filter toolbar over the already-fetched match list
 *  (`MatchesExplorer`), real score/skill/seniority/work-model data, the
 *  new Top-match badge and AI "why matched" bullets. */
export default async function JobMatchesPage({ params }: Props) {
  const { locale, jobId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });
  const tJobForm = await getTranslations({ locale, namespace: "jobForm" });

  const result = await getCandidateMatchesForJob(jobId);

  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok && result.reason === "not_an_employer") {
    return <p className="text-sm text-muted">{t("notEmployer")}</p>;
  }
  if (!result.ok) {
    return (
      <>
        <Link href="/recruit/matchmaking" className="text-sm text-pine hover:underline">
          ← {t("matchmaking")}
        </Link>
        <div className="mt-4 max-w-lg rounded-xl border border-line bg-paper/60 p-6 text-center">
          <p className="text-sm text-ink">{t("matchmakingUpsell")}</p>
          <Link href="/recruit/jobs/ads" className={`mt-4 inline-flex ${buttonClassName({ size: "md" })}`}>
            {t("pricing")}
          </Link>
        </div>
      </>
    );
  }

  const job = await getJobForEdit(jobId);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <Link href="/recruit/matchmaking" className="font-medium text-pine hover:underline">
          {t("matchmaking")}
        </Link>
        <span className="text-muted">/</span>
        <span className="text-muted">{result.jobTitle}</span>
      </div>

      <h1 className="mt-2 text-3xl font-bold lg:text-4xl">{t("matchedCandidatesHeading")}</h1>
      <p className="mt-1 text-sm text-muted">{t("matchedCandidatesSubtitle")}</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-pine">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display font-semibold text-ink">{result.jobTitle}</p>
            {job && (
              <p className="mt-0.5 text-xs text-muted">
                {job.location ?? t("remoteBadge")} · {tJobForm(`employmentTypeOption.${job.employment_type}`)}
              </p>
            )}
          </div>
        </div>
        <Link href="/recruit/matchmaking" className="shrink-0 text-sm font-medium text-pine hover:underline">
          ← {t("backToJobMatches")}
        </Link>
      </div>

      <MatchesExplorer jobId={jobId} matches={result.matches} />
    </>
  );
}
