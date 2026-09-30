import { notFound } from "next/navigation";
import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCandidateMatchesForJob, type CandidateMatch } from "@/lib/db/candidate-matches";
import { TechTags } from "@/components/TechTags";

type Props = { params: Promise<{ locale: string; jobId: string }> };
type T = Awaited<ReturnType<typeof getTranslations>>;
type Formatter = Awaited<ReturnType<typeof getFormatter>>;

const CANDIDATE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6 text-muted">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
  </svg>
);

function salaryRangeLabel(min: number, max: number, period: string, format: Formatter, tJobForm: T): string {
  const money = (v: number) => format.number(v, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  return `${money(min)}–${money(max)} ${tJobForm(`salaryPeriodOption.${period}`)}`;
}

function MatchCard({
  match,
  format,
  t,
  tJobForm,
}: {
  match: CandidateMatch;
  format: Formatter;
  t: T;
  tJobForm: T;
}) {
  return (
    <li className="flex flex-wrap items-start gap-4 border-b border-line py-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper">{CANDIDATE_ICON}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-ink">{match.headline || t("candidateAnonymous")}</p>
          <span className="rounded bg-pine/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-pine uppercase">
            {t("matchScoreShort", { percent: match.matchScore })}
          </span>
          {match.hasWorkHistory && (
            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted uppercase">
              {t("hasWorkHistory")}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {match.yearsExperience != null ? t("yearsExperience", { count: match.yearsExperience }) : t("yearsExperienceUnknown")}
          {match.preferredWorkModel ? ` · ${tJobForm(`workModelOption.${match.preferredWorkModel}`)}` : ""}
        </p>
        {match.skillLabels.length > 0 && (
          <div className="mt-2">
            <TechTags tech={match.skillLabels} max={6} />
          </div>
        )}
        {match.desiredSalary && (
          <p className="mt-2 text-sm font-medium text-ink">
            {salaryRangeLabel(match.desiredSalary.min, match.desiredSalary.max, match.desiredSalary.period, format, tJobForm)}
          </p>
        )}
      </div>
    </li>
  );
}

export default async function JobMatchesPage({ params }: Props) {
  const { locale, jobId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });
  const tJobForm = await getTranslations({ locale, namespace: "jobForm" });
  const format = await getFormatter({ locale });

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

  return (
    <>
      <Link href="/recruit/matchmaking" className="text-sm text-pine hover:underline">
        ← {t("matchmaking")}
      </Link>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{result.jobTitle}</h1>
        <span className="rounded-full bg-pine/10 px-3 py-1 text-sm font-semibold text-pine">
          {t("matchCount", { count: result.matches.length })}
        </span>
      </div>

      {result.matches.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("noMatchesYet")}</p>
      ) : (
        <ul className="mt-6 border-t border-line">
          {result.matches.map((match) => (
            <MatchCard key={match.candidateId} match={match} format={format} t={t} tJobForm={tJobForm} />
          ))}
        </ul>
      )}
    </>
  );
}
