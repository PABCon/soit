"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClassName } from "@/components/Button";
import { candidateDisplayNumber } from "@/lib/match-display";
import type { CandidateMatch } from "@/lib/db/candidate-matches";

type Sort = "bestMatch" | "mostExperienced";
type SeniorityBucket = "junior" | "mid" | "senior" | "lead";

/** Same real presentation value for a years-of-experience number as the
 *  job side's own seniority enum — reuses `jobForm.seniorityOption.*`
 *  rather than inventing new labels. There's no stored candidate
 *  "seniority" field (only the real `years_experience` number), so this
 *  is a deliberate, documented display bucketing of that real number,
 *  not a second, independent fact. */
function seniorityBucket(years: number | null): SeniorityBucket | null {
  if (years == null) return null;
  if (years < 2) return "junior";
  if (years < 5) return "mid";
  if (years < 10) return "senior";
  return "lead";
}

function scoreBarColor(score: number): string {
  if (score >= 85) return "bg-pine";
  if (score >= 75) return "bg-mint";
  return "bg-amber-500";
}

/** Round 26 (page 03) — client-side filter/sort over the already-
 *  fetched, already-scored match list, same established pattern as
 *  `JobsExplorer`/`ConsoleJobsExplorer`: no new DB round trip for
 *  narrowing a list this small. */
export function MatchesExplorer({ jobId, matches }: { jobId: string; matches: CandidateMatch[] }) {
  const t = useTranslations("console");
  const tJobForm = useTranslations("jobForm");

  const [sort, setSort] = useState<Sort>("bestMatch");
  const [workModel, setWorkModel] = useState("");
  const [seniority, setSeniority] = useState("");
  const [skill, setSkill] = useState("");

  const skillOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) for (const s of m.skillLabels) set.add(s);
    return [...set].sort();
  }, [matches]);

  const filtered = useMemo(() => {
    let result = matches.filter((m) => {
      if (workModel && m.preferredWorkModel !== workModel) return false;
      if (seniority && seniorityBucket(m.yearsExperience) !== seniority) return false;
      if (skill && !m.skillLabels.includes(skill)) return false;
      return true;
    });
    result = [...result].sort((a, b) =>
      sort === "mostExperienced"
        ? (b.yearsExperience ?? -1) - (a.yearsExperience ?? -1)
        : b.matchScore - a.matchScore,
    );
    return result;
  }, [matches, sort, workModel, seniority, skill]);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-line bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted uppercase">
          {t("sortByLabel")}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm font-normal text-ink normal-case"
          >
            <option value="bestMatch">{t("sortBestMatch")}</option>
            <option value="mostExperienced">{t("sortMostExperienced")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted uppercase">
          {tJobForm("workModel")}
          <select
            value={workModel}
            onChange={(e) => setWorkModel(e.target.value)}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm font-normal text-ink normal-case"
          >
            <option value="">{t("allOption")}</option>
            {(["remote", "hybrid", "office"] as const).map((w) => (
              <option key={w} value={w}>
                {tJobForm(`workModelOption.${w}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted uppercase">
          {tJobForm("seniority")}
          <select
            value={seniority}
            onChange={(e) => setSeniority(e.target.value)}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm font-normal text-ink normal-case"
          >
            <option value="">{t("allOption")}</option>
            {(["junior", "mid", "senior", "lead"] as const).map((s) => (
              <option key={s} value={s}>
                {tJobForm(`seniorityOption.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted uppercase">
          {t("skills")}
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm font-normal text-ink normal-case"
          >
            <option value="">{t("allOption")}</option>
            {skillOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("noMatchesYet")}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {filtered.map((match) => {
            const bucket = seniorityBucket(match.yearsExperience);
            const displayNumber = candidateDisplayNumber(match.candidateId);
            return (
              <li key={match.candidateId} className="flex flex-wrap items-start gap-4 rounded-xl border border-line bg-white p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pine font-display text-sm font-bold text-white">
                  C
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-semibold text-ink">{t("candidateNumber", { number: displayNumber })}</p>
                    {match.isTopMatch && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-green-700 uppercase">
                        {t("topMatchBadge")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {match.preferredLocationName && <span>{match.preferredLocationName}</span>}
                    {match.preferredWorkModel && <span>{tJobForm(`workModelOption.${match.preferredWorkModel}`)}</span>}
                    {bucket && <span>{tJobForm(`seniorityOption.${bucket}`)}</span>}
                    {match.yearsExperience != null && <span>{t("yearsExperience", { count: match.yearsExperience })}</span>}
                  </p>
                  {match.aiSummary && match.aiSummary.whyMatched.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {match.aiSummary.whyMatched.slice(0, 3).map((point, i) => (
                        <li key={i} className="text-xs text-muted">
                          · {point}
                        </li>
                      ))}
                    </ul>
                  )}
                  {match.skillLabels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {match.skillLabels.slice(0, 6).map((skillLabel) => (
                        <span key={skillLabel} className="rounded-md border border-line bg-paper px-2 py-0.5 text-xs text-ink">
                          {skillLabel}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="font-display text-lg font-bold text-pine">{t("matchScoreShort", { percent: match.matchScore })}</p>
                    <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full ${scoreBarColor(match.matchScore)}`}
                        style={{ width: `${match.matchScore}%` }}
                      />
                    </div>
                  </div>
                  <Link href={`/recruit/matchmaking/${jobId}/${match.candidateId}`} className={buttonClassName({ size: "md" })}>
                    {t("reviewProfile")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
