import { createClient } from "@/lib/supabase/server";
import { toJob, hideSalaryIfPrivate, type JobRow } from "./jobs";
import { getMyCandidateSkillsAndEducation, getMyCandidateJobPreferences } from "./candidate-profile";
import type { Job, SkillLevel } from "@/lib/types";

// §AI Pieces backlog, item 4 — "find me the top 5 best fitting jobs for
// me." A deliberate, lightweight, explainable heuristic — NOT the bigger
// employer-paid matching engine (item 3, its own future piece). Reuses
// the exact same candidate/job vocabulary (tech_tags ids, job
// preferences) rather than any new scoring infrastructure.

// jobs.ts's own SELECT/JobRow don't carry job_tech_tags' ids/level/
// required or a scalar category_id — enough for the public feed's
// display, not enough to score against. A dedicated select here (same
// precedent getJobForEdit already set for its own distinct read shape)
// rather than touching the widely-reused shared SELECT.
const RECS_SELECT = `
  id, slug, title, description, language, seniority, work_model, location,
  latitude, longitude, salary_min, salary_max, salary_currency, salary_period,
  salary_months, employment_type, status, published_at, expires_at, created_at,
  external_apply_url, location_id, category_id, salary_public, boost_rank_at, boosted_until,
  companies!inner ( slug, company_name, company_logo_url, top_employer_active ),
  job_tech_tags ( tech_tag_id, level, required, tech_tags ( slug, label ) ),
  job_categories ( slug ),
  locations ( slug ),
  job_languages ( level, spoken_languages ( slug, label ) )
`;

type RecsJobRow = Omit<JobRow, "job_tech_tags"> & {
  category_id: string | null;
  job_tech_tags: {
    tech_tag_id: string;
    level: SkillLevel | null;
    required: boolean;
    tech_tags: { slug: string; label: string };
  }[];
};

// Below this, a job is excluded from results entirely — see the filter
// where it's used for the real-usage reasoning. Raised from 30 after a
// real false positive: a candidate with a purely business/delivery
// background (no data-engineering skills at all) was shown a "Senior
// Big Data Engineer" role as a match. Root cause was the neutral
// defaults below stacking up to a plausible-looking score with zero
// actual skill evidence — fixed together with this raise, since raising
// the bar alone without shrinking those defaults would only move
// where the same failure resurfaces.
const MIN_MATCH_SCORE = 70;

export type RecommendedJob = Job & { matchScore: number; matchedTechLabels: string[] };

export type RecommendationsResult =
  | { ok: true; jobs: RecommendedJob[] }
  | { ok: false; reason: "not_a_candidate" | "empty_profile" | "no_preferences" };

/** Scores one job against a candidate's skill-id set and job preferences.
 *  Every weighted bucket is additive-only — a preference the candidate
 *  never set contributes neither points nor a penalty, so a candidate
 *  who's only filled in skills (no preferences yet) still gets a
 *  meaningful, non-punished score. Max ~100: 60 required-skill coverage
 *  + 10 nice-to-have bonus + up to 30 spread across whichever
 *  preferences are actually set (category/location/work model/
 *  employment type/salary), reweighted so unset ones don't shrink the
 *  achievable total. Salary is only compared when the job and the
 *  candidate's preference share the same period — comparing e.g. an
 *  hourly rate against an annual preference would be meaningless, so
 *  that case contributes nothing rather than guessing. */
function scoreJob(
  row: RecsJobRow,
  skillIds: Set<string>,
  prefs: Awaited<ReturnType<typeof getMyCandidateJobPreferences>>,
): { score: number; matchedTechLabels: string[] } {
  const requiredTags = row.job_tech_tags.filter((t) => t.required);
  const niceTags = row.job_tech_tags.filter((t) => !t.required);
  const matchedTechLabels = row.job_tech_tags
    .filter((t) => skillIds.has(t.tech_tag_id))
    .map((t) => t.tech_tags.label);

  let score = 0;
  if (requiredTags.length > 0) {
    const matched = requiredTags.filter((t) => skillIds.has(t.tech_tag_id)).length;
    score += (matched / requiredTags.length) * 60;
  } else {
    // Neutral, but deliberately *low* (not half-credit): an employer
    // who never tagged required skills gives us no evidence this job
    // fits the candidate at all, so this alone — even stacked with a
    // full preference match — must stay well under MIN_MATCH_SCORE.
    score += 10;
  }

  if (niceTags.length > 0) {
    const matched = niceTags.filter((t) => skillIds.has(t.tech_tag_id)).length;
    score += Math.min(10, (matched / niceTags.length) * 10);
  }

  if (prefs) {
    let prefPoints = 0;
    let prefWeight = 0;

    if (prefs.categoryIds.length > 0) {
      prefWeight += 10;
      if (row.category_id && prefs.categoryIds.includes(row.category_id)) prefPoints += 10;
    }
    if (prefs.locationIds.length > 0) {
      prefWeight += 10;
      if ((row.location_id && prefs.locationIds.includes(row.location_id)) || row.work_model === "remote") {
        prefPoints += 10;
      }
    }
    if (prefs.workModel) {
      prefWeight += 5;
      if (row.work_model === prefs.workModel) prefPoints += 5;
    }
    if (prefs.employmentType) {
      prefWeight += 5;
      if (row.employment_type === prefs.employmentType) prefPoints += 5;
    }
    if (prefs.salaryMin != null || prefs.salaryMax != null) {
      prefWeight += 5;
      if (prefs.salaryPeriod && prefs.salaryPeriod === row.salary_period) {
        const prefMin = prefs.salaryMin ?? 0;
        const prefMax = prefs.salaryMax ?? Number.POSITIVE_INFINITY;
        if (row.salary_max >= prefMin && row.salary_min <= prefMax) prefPoints += 5;
      }
    }

    score += prefWeight > 0 ? (prefPoints / prefWeight) * 30 : 15;
  }

  return { score: Math.round(Math.min(100, score)), matchedTechLabels };
}

/** Same `my_candidate_id()` guard every candidate-scoped function uses
 *  (`getMyFavoriteJobIds` is the direct precedent) — `not_a_candidate`
 *  distinguishes "no session" from a candidate with a genuinely thin
 *  profile (`empty_profile`), so callers can show the right prompt
 *  instead of a meaningless score-everything-equally list. */
export async function getJobRecommendationsForCandidate(limit = 20): Promise<RecommendationsResult> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };

  const [skillsAndEducation, prefs] = await Promise.all([
    getMyCandidateSkillsAndEducation(),
    getMyCandidateJobPreferences(),
  ]);

  const skillIds = new Set((skillsAndEducation?.techTags ?? []).map((t) => t.techTagId));
  const hasPrefs =
    !!prefs &&
    (prefs.categoryIds.length > 0 ||
      prefs.locationIds.length > 0 ||
      !!prefs.workModel ||
      !!prefs.employmentType ||
      prefs.salaryMin != null ||
      prefs.salaryMax != null);

  // Preferences are enforced as a hard prerequisite, not just an
  // optional scoring input — a candidate with skills but no job
  // preferences was exactly the profile shape behind the Big Data
  // Engineer false positive above (the missing-preferences neutral
  // default was the other half of that stacked score).
  if (skillIds.size === 0) return { ok: false, reason: "empty_profile" };
  if (!hasPrefs) return { ok: false, reason: "no_preferences" };

  const { data } = await supabase
    .from("jobs")
    .select(RECS_SELECT)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString());

  if (!data) return { ok: true, jobs: [] };

  const rows = data as unknown as RecsJobRow[];
  const scored = rows
    .map((row) => {
      const { score, matchedTechLabels } = scoreJob(row, skillIds, prefs);
      return { job: hideSalaryIfPrivate(row, toJob(row)), matchScore: score, matchedTechLabels };
    })
    // A job with near-zero overlap isn't a "match" just because it's live —
    // calling it one would over-promise (a candidate seeing "4 jobs match
    // you" and finding most are 0-10% reads as clickbait in the bad sense).
    // Below this, "no matches yet" is the honest answer.
    .filter((s) => s.matchScore >= MIN_MATCH_SCORE);

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return {
    ok: true,
    jobs: scored.slice(0, limit).map((s) => ({ ...s.job, matchScore: s.matchScore, matchedTechLabels: s.matchedTechLabels })),
  };
}
