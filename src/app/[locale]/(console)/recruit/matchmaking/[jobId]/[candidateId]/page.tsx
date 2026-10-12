import { notFound } from "next/navigation";
import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCandidateMatchDetail } from "@/lib/db/candidate-matches";
import { StartThreadButton } from "@/components/StartThreadButton";
import { MatchStatusSelect } from "@/components/console/MatchStatusSelect";
import { MatchSummarySection } from "@/components/console/MatchSummarySection";
import { candidateDisplayNumber } from "@/lib/match-display";
import { startMatchThreadAction } from "../actions";

type Props = { params: Promise<{ locale: string; jobId: string; candidateId: string }> };

/** Round 26 (page 04 reference) — the blinded match's own profile page.
 *  Per the user's explicit Decision 1: the mockup's disabled "Reveal
 *  contact details"/"View CV" controls are replaced with the one real
 *  action this project actually has for unblinding a match — a message,
 *  via the same `StartThreadButton`/`startMatchThreadAction` the phase-B
 *  messaging work already built (identity only ever unlocks when the
 *  *candidate* replies — see messaging.ts's `sendMessage`). The Hidden
 *  field labels stay, as pure explanation, not a fake control. */
export default async function MatchCandidateProfilePage({ params }: Props) {
  const { locale, jobId, candidateId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });
  const tJobForm = await getTranslations({ locale, namespace: "jobForm" });
  const tp = await getTranslations({ locale, namespace: "profile" });
  const format = await getFormatter({ locale });

  const result = await getCandidateMatchDetail(jobId, candidateId);
  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok && result.reason === "not_an_employer") {
    return <p className="text-sm text-muted">{t("notEmployer")}</p>;
  }
  if (!result.ok) {
    return (
      <div className="mt-4 max-w-lg rounded-xl border border-line bg-paper/60 p-6 text-center">
        <p className="text-sm text-ink">{t("matchmakingUpsell")}</p>
        <Link href="/recruit/jobs/ads" className="mt-4 inline-flex h-10 items-center rounded-lg bg-pine px-5 text-sm font-semibold text-white hover:bg-pine/90">
          {t("pricing")}
        </Link>
      </div>
    );
  }

  const { match, jobTitle } = result;
  const displayNumber = candidateDisplayNumber(candidateId);

  return (
    <>
      <Link href={`/recruit/matchmaking/${jobId}`} className="text-sm font-medium text-pine hover:underline">
        ← {t("backToJobMatches")}
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold">{t("candidateNumber", { number: displayNumber })}</h1>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
              {t("matchedCandidateBadge")}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {match.aiSummaryGeneratedAt
              ? t("matchedForWithDate", { job: jobTitle, date: format.dateTime(new Date(match.aiSummaryGeneratedAt), { dateStyle: "short" }) })
              : t("matchedForNoDate", { job: jobTitle })}
          </p>
        </div>
        <MatchStatusSelect jobId={jobId} candidateId={candidateId} initialStatus={match.status} />
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-[1fr_16rem]">
        <div className="min-w-0 space-y-6">
          <MatchSummarySection jobId={jobId} candidateId={candidateId} initialSummary={match.aiSummary} />

          {match.skills.length > 0 && (
            <section>
              <h2 className="font-display text-sm font-semibold text-muted">{t("skills")}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {match.skills.map((skill) => (
                  <span key={skill.label} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-1 py-1 pl-3 text-xs text-ink">
                    {skill.label}
                    {skill.level && (
                      <span className="rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-medium text-pine">
                        {tJobForm(`levelOption.${skill.level}`)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-display text-sm font-semibold text-muted">{t("experienceSectionHeading")}</h2>
            <p className="mt-2 text-sm text-ink">
              {match.yearsExperience != null ? t("yearsExperience", { count: match.yearsExperience }) : t("yearsExperienceUnknown")}
            </p>
            {match.aiSummary?.experienceSummary && (
              <p className="mt-1 text-sm leading-relaxed text-muted">{match.aiSummary.experienceSummary}</p>
            )}
          </section>
        </div>

        <aside className="space-y-4 rounded-xl border border-line bg-white p-4">
          <h2 className="font-display text-sm font-semibold text-ink">{t("contactInfoHeading")}</h2>
          <div className="flex items-start gap-2 rounded-lg bg-paper p-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <p className="text-xs text-muted">{t("contactInfoHiddenNote")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted uppercase">{tp("email")}</p>
            <p className="text-sm text-muted">{t("hiddenValue")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted uppercase">{tp("phone")}</p>
            <p className="text-sm text-muted">{t("hiddenValue")}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted uppercase">{tp("linkedinUrl")}</p>
            <p className="text-sm text-muted">{t("hiddenValue")}</p>
          </div>
          <div className="border-t border-line pt-3">
            <StartThreadButton redirectBase="/recruit/messages" onSend={startMatchThreadAction.bind(null, candidateId, jobId)} />
          </div>
          <p className="text-xs text-muted">{t("cvNote")}</p>
        </aside>
      </div>
    </>
  );
}
