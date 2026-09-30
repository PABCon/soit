import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployerContext } from "./companies";
import { getJobForEdit, getCompanyJobs } from "./jobs";
import { scoreJobMatch, MIN_MATCH_SCORE, type CandidatePrefsForScoring } from "./matching-scoring";

// §AI Pieces backlog, item 3 — the employer-paid matching engine,
// replicating justjoin.it's "Matchmaking Beta" mechanic (source: the PDF
// you shared). Phase A only: a blinded, scored candidate list per job.
// No messaging, no identity unlock — that's phase B, a separate piece,
// once this is real and reviewed.
//
// `candidates` has genuinely zero RLS read access for employers
// ("Employers never read this table" — confirmed in
// 20260921120100_rls.sql, one SELECT policy, scoped to the candidate's
// own auth_user_id). The only legitimate precedent for an employer
// seeing any candidate field is `getApplicantsForJob` in applications.ts
// — admin client, scoped in application code, never a new RLS policy.
// This follows the exact same shape, with one deliberate difference:
// applicants are scoped by a real relationship (an application exists);
// here there's no relationship yet, only company ownership of the job +
// paying-customer status, so the select list below is hard-limited to
// non-identifying columns — never full_name/email/phone/linkedin_url/
// avatar_url/cv_url. Those stay entirely absent from the query itself,
// not just unused in the response type, so a later change can't
// accidentally leak them.
const SCORABLE_CANDIDATE_SELECT = `
  id, headline, years_experience, preferred_work_model, preferred_employment_type,
  desired_salary_min, desired_salary_max, desired_salary_period,
  candidate_tech_tags ( tech_tag_id, tech_tags ( label ) ),
  candidate_preferred_categories ( category_id ),
  candidate_preferred_locations ( location_id ),
  candidate_experience ( id )
`;

type ScorableCandidateRow = {
  id: string;
  headline: string | null;
  years_experience: number | null;
  preferred_work_model: string | null;
  preferred_employment_type: string | null;
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  desired_salary_period: string | null;
  candidate_tech_tags: { tech_tag_id: string; tech_tags: { label: string } }[];
  candidate_preferred_categories: { category_id: string }[];
  candidate_preferred_locations: { location_id: string }[];
  candidate_experience: { id: string }[];
};

export type CandidateMatch = {
  candidateId: string;
  matchScore: number;
  headline: string | null;
  yearsExperience: number | null;
  skillLabels: string[];
  desiredSalary: { min: number; max: number; period: string } | null;
  preferredWorkModel: string | null;
  hasWorkHistory: boolean;
};

/** Company-level, not per-job — the same rule `saveJob`/`setJobStatus`
 *  already use for hiding a salary or getting bump credits: any of a
 *  paying company's jobs get the perk, not just the slot a credit
 *  happened to fund. */
function isPayingCustomer(company: { ad_credits_available: number; top_employer_active: boolean }): boolean {
  return company.ad_credits_available > 0 || company.top_employer_active;
}

async function fetchScorableCandidates(): Promise<ScorableCandidateRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("candidates").select(SCORABLE_CANDIDATE_SELECT);
  return (data as unknown as ScorableCandidateRow[]) ?? [];
}

function candidatePrefsFromRow(row: ScorableCandidateRow): CandidatePrefsForScoring {
  return {
    categoryIds: row.candidate_preferred_categories.map((c) => c.category_id),
    locationIds: row.candidate_preferred_locations.map((l) => l.location_id),
    workModel: row.preferred_work_model,
    employmentType: row.preferred_employment_type,
    salaryMin: row.desired_salary_min,
    salaryMax: row.desired_salary_max,
    salaryPeriod: row.desired_salary_period,
  };
}

export type CandidateMatchesResult =
  | { ok: true; jobTitle: string; matches: CandidateMatch[] }
  | { ok: false; reason: "not_an_employer" | "not_found" | "not_paying" };

export async function getCandidateMatchesForJob(jobId: string, limit = 50): Promise<CandidateMatchesResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const job = await getJobForEdit(jobId);
  if (!job || job.company_id !== ctx.company.id) return { ok: false, reason: "not_found" };
  if (!isPayingCustomer(ctx.company)) return { ok: false, reason: "not_paying" };

  const candidates = await fetchScorableCandidates();
  const tags = job.job_tech_tags.map((t) => ({ techTagId: t.tech_tag_id, required: t.required }));
  const jobFacts = {
    categoryId: job.category_id,
    locationId: job.location_id,
    workModel: job.work_model,
    employmentType: job.employment_type,
    salaryMin: job.salary_min,
    salaryMax: job.salary_max,
    salaryPeriod: job.salary_period,
  };

  const scored = candidates
    .map((row) => {
      const skillIds = new Set(row.candidate_tech_tags.map((t) => t.tech_tag_id));
      const matchScore = scoreJobMatch(jobFacts, tags, skillIds, candidatePrefsFromRow(row));
      const match: CandidateMatch = {
        candidateId: row.id,
        matchScore,
        headline: row.headline,
        yearsExperience: row.years_experience,
        skillLabels: row.candidate_tech_tags.map((t) => t.tech_tags.label),
        desiredSalary:
          row.desired_salary_min != null && row.desired_salary_max != null && row.desired_salary_period
            ? { min: row.desired_salary_min, max: row.desired_salary_max, period: row.desired_salary_period }
            : null,
        preferredWorkModel: row.preferred_work_model,
        hasWorkHistory: row.candidate_experience.length > 0,
      };
      return match;
    })
    .filter((m) => m.matchScore >= MIN_MATCH_SCORE);

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return { ok: true, jobTitle: job.title, matches: scored.slice(0, limit) };
}

export type JobMatchCount = { jobId: string; matchCount: number };

/** Powers the `/recruit/matchmaking` overview — one candidate fetch,
 *  scored against every live job at once, rather than a separate query
 *  per job card. */
export async function getMatchCountsForCompanyJobs(): Promise<JobMatchCount[]> {
  const ctx = await getMyEmployerContext();
  if (!ctx || !isPayingCustomer(ctx.company)) return [];

  const activeJobs = await getCompanyJobs(ctx.company.id, "active");
  if (activeJobs.length === 0) return [];

  const [candidates, ...jobsForEdit] = await Promise.all([
    fetchScorableCandidates(),
    ...activeJobs.map((j) => getJobForEdit(j.id)),
  ]);

  return jobsForEdit
    .filter((job): job is NonNullable<typeof job> => job !== null)
    .map((job) => {
      const tags = job.job_tech_tags.map((t) => ({ techTagId: t.tech_tag_id, required: t.required }));
      const jobFacts = {
        categoryId: job.category_id,
        locationId: job.location_id,
        workModel: job.work_model,
        employmentType: job.employment_type,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        salaryPeriod: job.salary_period,
      };
      const matchCount = candidates.filter((row) => {
        const skillIds = new Set(row.candidate_tech_tags.map((t) => t.tech_tag_id));
        return scoreJobMatch(jobFacts, tags, skillIds, candidatePrefsFromRow(row)) >= MIN_MATCH_SCORE;
      }).length;
      return { jobId: job.id, matchCount };
    });
}
