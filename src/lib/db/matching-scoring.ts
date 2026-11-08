// Shared scoring core for both matching directions — candidate-facing job
// recommendations (`recommendations.ts`) and employer-facing candidate
// matches (`candidate-matches.ts`, §AI Pieces item 3). Extracted so the
// two directions provably use the identical bucket math rather than two
// copies that could silently drift apart later. Max 100: 60 pts for
// required-skill id-set coverage (neutral 10 if the job tagged no
// required skills — deliberately low, not half-credit, so it alone can
// never carry a match past MIN_MATCH_SCORE), up to 10 for nice-to-have
// overlap, up to 30 spread across whichever candidate preferences are
// actually set (reweighted so unset ones don't shrink the achievable
// total — a candidate/job pair with only skills filled in still gets a
// meaningful score). Salary only counts when both sides share the same
// period — comparing an hourly rate against an annual preference would
// be meaningless.

export type ScoringTag = { techTagId: string; required: boolean };

export type JobFactsForScoring = {
  categoryId: string | null;
  locationId: string | null;
  workModel: string;
  employmentType: string;
  /** Null for a bulk-imported draft still missing it (§job-import) — can
   *  only ever reach this scoring function for a published job in
   *  practice (the DB itself requires a published job to have both), but
   *  typed honestly rather than asserted, same as categoryId/locationId
   *  above. */
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string;
};

export type CandidatePrefsForScoring = {
  categoryIds: string[];
  locationIds: string[];
  workModel: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: string | null;
  /** Where the candidate actually lives (`candidates.location_id`) —
   *  deliberately distinct from `locationIds` above, which is a
   *  job-search *preference* the candidate opted into and is often
   *  left empty. This is the real-world fact that makes an on-site/
   *  hybrid role in a different city physically impossible, regardless
   *  of how well the skills line up — see its use below. */
  residenceLocationId: string | null;
} | null;

// Raised from 30 after a real false positive: a candidate with a purely
// business/delivery background (no data-engineering skills at all) was
// shown a "Senior Big Data Engineer" role as a match. Root cause was the
// neutral defaults stacking up to a plausible-looking score with zero
// actual skill evidence — the low required-skill neutral (10, not the
// old 30) fixes that at the source.
export const MIN_MATCH_SCORE = 70;

export function scoreJobMatch(
  job: JobFactsForScoring,
  tags: ScoringTag[],
  candidateSkillIds: Set<string>,
  candidatePrefs: CandidatePrefsForScoring,
): number {
  // Real-usage report: a candidate based in Warsaw was surfacing as a
  // match for on-site/hybrid Lisbon roles — skill overlap and preference
  // neutrals alone could carry a score past threshold with zero regard
  // for whether the person could physically do the job. A known
  // residence that doesn't match the job's own city is a hard
  // disqualifier for anything that isn't fully remote, checked before
  // any other scoring — no amount of skill overlap should out-vote
  // physical geography. An *unknown* residence (the common case until
  // candidates fill this in) stays neutral, same as every other unset
  // preference below, rather than retroactively blocking everyone who
  // hasn't set it yet.
  if (
    job.workModel !== "remote" &&
    candidatePrefs?.residenceLocationId &&
    job.locationId &&
    candidatePrefs.residenceLocationId !== job.locationId
  ) {
    return 0;
  }

  const requiredTags = tags.filter((t) => t.required);
  const niceTags = tags.filter((t) => !t.required);

  let score = 0;
  if (requiredTags.length > 0) {
    const matched = requiredTags.filter((t) => candidateSkillIds.has(t.techTagId)).length;
    score += (matched / requiredTags.length) * 60;
  } else {
    score += 10;
  }

  if (niceTags.length > 0) {
    const matched = niceTags.filter((t) => candidateSkillIds.has(t.techTagId)).length;
    score += Math.min(10, (matched / niceTags.length) * 10);
  }

  if (candidatePrefs) {
    let prefPoints = 0;
    let prefWeight = 0;

    if (candidatePrefs.categoryIds.length > 0) {
      prefWeight += 10;
      if (job.categoryId && candidatePrefs.categoryIds.includes(job.categoryId)) prefPoints += 10;
    }
    if (candidatePrefs.locationIds.length > 0) {
      prefWeight += 10;
      if ((job.locationId && candidatePrefs.locationIds.includes(job.locationId)) || job.workModel === "remote") {
        prefPoints += 10;
      }
    }
    if (candidatePrefs.workModel) {
      prefWeight += 5;
      if (job.workModel === candidatePrefs.workModel) prefPoints += 5;
    }
    if (candidatePrefs.employmentType) {
      prefWeight += 5;
      if (job.employmentType === candidatePrefs.employmentType) prefPoints += 5;
    }
    if (candidatePrefs.salaryMin != null || candidatePrefs.salaryMax != null) {
      prefWeight += 5;
      if (job.salaryMin != null && job.salaryMax != null && candidatePrefs.salaryPeriod === job.salaryPeriod) {
        const prefMin = candidatePrefs.salaryMin ?? 0;
        const prefMax = candidatePrefs.salaryMax ?? Number.POSITIVE_INFINITY;
        if (job.salaryMax >= prefMin && job.salaryMin <= prefMax) prefPoints += 5;
      }
    }

    // Real false positive, caught via live data: a candidate with zero
    // preferences set (common — nothing forces a candidate to fill
    // these in) used to still collect a flat 15 here regardless, just
    // for having a non-null prefs object. Combined with thin job tagging
    // elsewhere, that free +15 was enough on its own to push an
    // otherwise-unconvincing match over MIN_MATCH_SCORE. Zero signal now
    // earns zero points — the skill buckets above are the only way to
    // reach threshold when a candidate hasn't told us anything else.
    score += prefWeight > 0 ? (prefPoints / prefWeight) * 30 : 0;
  }

  return Math.round(Math.min(100, score));
}
