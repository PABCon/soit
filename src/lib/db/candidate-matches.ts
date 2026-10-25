import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployerContext } from "./companies";
import { getJobForEdit, getCompanyJobs } from "./jobs";
import { scoreJobMatch, MIN_MATCH_SCORE, type CandidatePrefsForScoring } from "./matching-scoring";
import { generateMatchSummaries, generateSingleMatchSummary, type JobFactsForPrompt, type MatchSummary } from "@/lib/ai/match-summary";

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
//
// `headline` was fetched here too in the original phase-A build (it was
// shown directly in the old card UI), but round 26's own live
// verification caught a real, if subtle, leak class: even once the
// restyled UI stopped *rendering* it anywhere, it was still present on
// the `CandidateMatch` objects passed as props to a Client Component
// (`MatchesExplorer`) — and Next.js serializes a Client Component's full
// prop value into the page's RSC payload for hydration, regardless of
// what the component actually renders from it. A candidate's own
// free-text headline can readily contain a real employer name (a real
// test case did: "Senior Engineer at <RealCompany>"), so it's dropped
// from the select/type entirely rather than just left unrendered —
// "unused in the response type" isn't actually enough once that
// response crosses a server→client boundary; it has to be absent from
// the data itself.
// `locations(name)` on the preferred-locations join is a deliberate,
// narrow addition (round 26, page 03/04's own location chip) — a city
// *preference* the candidate submitted themselves is the same category
// of non-identifying fact `preferred_work_model` already is, not a real
// address or employer; still never `candidates.location`-shaped PII.
const SCORABLE_CANDIDATE_SELECT = `
  id, years_experience, preferred_work_model, preferred_employment_type,
  desired_salary_min, desired_salary_max, desired_salary_period,
  candidate_tech_tags ( tech_tag_id, level, tech_tags ( label ) ),
  candidate_preferred_categories ( category_id ),
  candidate_preferred_locations ( location_id, locations ( name ) ),
  candidate_experience ( id )
`;

type ScorableCandidateRow = {
  id: string;
  years_experience: number | null;
  preferred_work_model: string | null;
  preferred_employment_type: string | null;
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  desired_salary_period: string | null;
  candidate_tech_tags: { tech_tag_id: string; level: string | null; tech_tags: { label: string } }[];
  candidate_preferred_categories: { category_id: string }[];
  candidate_preferred_locations: { location_id: string; locations: { name: string } }[];
  candidate_experience: { id: string }[];
};

export type MatchStatus = "new" | "shortlisted" | "contacted" | "passed";

export type CandidateMatch = {
  candidateId: string;
  matchScore: number;
  yearsExperience: number | null;
  skillLabels: string[];
  skills: { label: string; level: string | null }[];
  desiredSalary: { min: number; max: number; period: string } | null;
  preferredWorkModel: string | null;
  preferredLocationName: string | null;
  hasWorkHistory: boolean;
  status: MatchStatus;
  isTopMatch: boolean;
  /** null until an employer has generated it (or the list's own batch
   *  generation has run) — see generateMatchSummaries' own comment for
   *  why this is cached, not recomputed on every view. */
  aiSummary: MatchSummary | null;
  aiSummaryGeneratedAt: string | null;
};

/** Company-level, not per-job — the same rule `saveJob`/`setJobStatus`
 *  already use for hiding a salary or getting bump credits: any of a
 *  paying company's jobs get the perk, not just the slot a credit
 *  happened to fund. */
function isPayingCustomer(company: { job_ad_slot_cap: number; top_employer_active: boolean }): boolean {
  return company.job_ad_slot_cap > 1 || company.top_employer_active;
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

type MatchNoteRow = {
  candidate_id: string;
  status: MatchStatus;
  ai_summary: MatchSummary | null;
  ai_summary_generated_at: string | null;
};

async function fetchMatchNotes(companyId: string, jobId: string): Promise<Map<string, MatchNoteRow>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidate_match_notes")
    .select("candidate_id, status, ai_summary, ai_summary_generated_at")
    .eq("company_id", companyId)
    .eq("job_id", jobId);
  return new Map((data ?? []).map((row) => [row.candidate_id, row as MatchNoteRow]));
}

function jobFactsForPrompt(job: {
  title: string;
  seniority: string;
  work_model: string;
  job_tech_tags: { tech_tag_id: string; required: boolean }[];
}, tagLabels: Map<string, string>): JobFactsForPrompt {
  const required = job.job_tech_tags.filter((t) => t.required).map((t) => tagLabels.get(t.tech_tag_id)).filter((l): l is string => !!l);
  const niceToHave = job.job_tech_tags.filter((t) => !t.required).map((t) => tagLabels.get(t.tech_tag_id)).filter((l): l is string => !!l);
  return {
    title: job.title,
    requiredSkillLabels: required,
    niceToHaveSkillLabels: niceToHave,
    categoryLabel: null,
    workModel: job.work_model,
    seniority: job.seniority,
  };
}

async function fetchTagLabels(techTagIds: string[]): Promise<Map<string, string>> {
  if (techTagIds.length === 0) return new Map();
  const admin = createAdminClient();
  const { data } = await admin.from("tech_tags").select("id, label").in("id", techTagIds);
  return new Map((data ?? []).map((t) => [t.id, t.label]));
}

/** Upserts whatever the batch/single generation actually returned —
 *  called with the admin client since `ai_summary`/`ai_summary_
 *  generated_at` are server-computed state, same reasoning messaging.ts
 *  already uses for `identity_unlocked`. */
async function cacheMatchSummaries(companyId: string, jobId: string, summaries: Map<string, MatchSummary>) {
  if (summaries.size === 0) return;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await Promise.all(
    Array.from(summaries.entries()).map(([candidateId, summary]) =>
      admin.from("candidate_match_notes").upsert(
        {
          company_id: companyId,
          job_id: jobId,
          candidate_id: candidateId,
          ai_summary: summary,
          ai_summary_generated_at: now,
          updated_at: now,
        },
        { onConflict: "company_id,job_id,candidate_id" },
      ),
    ),
  );
}

export type CandidateMatchesResult =
  | { ok: true; jobTitle: string; matches: CandidateMatch[] }
  | { ok: false; reason: "not_an_employer" | "not_found" | "not_paying" };

export async function getCandidateMatchesForJob(jobId: string, limit = 200): Promise<CandidateMatchesResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const job = await getJobForEdit(jobId);
  if (!job || job.company_id !== ctx.company.id) return { ok: false, reason: "not_found" };
  if (!isPayingCustomer(ctx.company)) return { ok: false, reason: "not_paying" };

  const [candidates, notes] = await Promise.all([fetchScorableCandidates(), fetchMatchNotes(ctx.company.id, jobId)]);
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
      const note = notes.get(row.id);
      const match: CandidateMatch = {
        candidateId: row.id,
        matchScore,
        yearsExperience: row.years_experience,
        skillLabels: row.candidate_tech_tags.map((t) => t.tech_tags.label),
        skills: row.candidate_tech_tags.map((t) => ({ label: t.tech_tags.label, level: t.level })),
        desiredSalary:
          row.desired_salary_min != null && row.desired_salary_max != null && row.desired_salary_period
            ? { min: row.desired_salary_min, max: row.desired_salary_max, period: row.desired_salary_period }
            : null,
        preferredWorkModel: row.preferred_work_model,
        preferredLocationName: row.candidate_preferred_locations[0]?.locations?.name ?? null,
        hasWorkHistory: row.candidate_experience.length > 0,
        status: note?.status ?? "new",
        isTopMatch: false,
        aiSummary: note?.ai_summary ?? null,
        aiSummaryGeneratedAt: note?.ai_summary_generated_at ?? null,
      };
      return match;
    })
    .filter((m) => m.matchScore >= MIN_MATCH_SCORE);

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const matches = scored.slice(0, limit);
  if (matches.length > 0) matches[0].isTopMatch = true;

  // Batch-generate summaries for whichever candidates on this page don't
  // have one cached yet — a real AI call, but only ever once per (job,
  // candidate) pair (see generateMatchSummaries' own comment), never on
  // every view of an already-summarized list.
  const missing = matches.filter((m) => !m.aiSummary);
  if (missing.length > 0) {
    const tagLabels = await fetchTagLabels(tags.map((t) => t.techTagId));
    const jobFacts2 = jobFactsForPrompt(job, tagLabels);
    const generated = await generateMatchSummaries(
      jobFacts2,
      missing.map((m) => ({
        candidateId: m.candidateId,
        yearsExperience: m.yearsExperience,
        skillLabels: m.skillLabels,
        desiredSalary: m.desiredSalary,
        preferredWorkModel: m.preferredWorkModel,
        matchScore: m.matchScore,
      })),
    );
    if (generated.size > 0) {
      await cacheMatchSummaries(ctx.company.id, jobId, generated);
      for (const m of matches) {
        const g = generated.get(m.candidateId);
        if (g) m.aiSummary = g;
      }
    }
  }

  return { ok: true, jobTitle: job.title, matches };
}

export type CandidateMatchDetailResult =
  | { ok: true; jobTitle: string; match: CandidateMatch }
  | { ok: false; reason: "not_an_employer" | "not_found" | "not_paying" };

/** Page 04 (candidate profile) — reuses the same list computation and
 *  picks out one candidate, rather than a parallel query shape; a match
 *  only exists in the context of its already-computed, already-sorted
 *  job list anyway. */
export async function getCandidateMatchDetail(jobId: string, candidateId: string): Promise<CandidateMatchDetailResult> {
  const result = await getCandidateMatchesForJob(jobId);
  if (!result.ok) return result;
  const match = result.matches.find((m) => m.candidateId === candidateId);
  if (!match) return { ok: false, reason: "not_found" };
  return { ok: true, jobTitle: result.jobTitle, match };
}

export type JobMatchCount = { jobId: string; matchCount: number; lastCheckedAt: string | null };

/** Powers the `/recruit/matchmaking` overview — one candidate fetch,
 *  scored against every live job at once, rather than a separate query
 *  per job card. `lastCheckedAt` is a real, stored fact — the most
 *  recent `candidate_match_notes.updated_at` for that job (a status
 *  change or an AI-summary generation), not a fabricated "last viewed"
 *  timestamp this feature doesn't actually track; a job with no notes
 *  yet simply has no "last checked" date, same as it never being opened. */
export async function getMatchCountsForCompanyJobs(): Promise<JobMatchCount[]> {
  const ctx = await getMyEmployerContext();
  if (!ctx || !isPayingCustomer(ctx.company)) return [];

  const activeJobs = await getCompanyJobs(ctx.company.id, "active");
  if (activeJobs.length === 0) return [];

  const supabase = await createClient();
  const [candidates, lastCheckedRows, ...jobsForEdit] = await Promise.all([
    fetchScorableCandidates(),
    supabase
      .from("candidate_match_notes")
      .select("job_id, updated_at")
      .eq("company_id", ctx.company.id)
      .in("job_id", activeJobs.map((j) => j.id)),
    ...activeJobs.map((j) => getJobForEdit(j.id)),
  ]);

  const lastCheckedByJob = new Map<string, string>();
  for (const row of lastCheckedRows.data ?? []) {
    const current = lastCheckedByJob.get(row.job_id);
    if (!current || row.updated_at > current) lastCheckedByJob.set(row.job_id, row.updated_at);
  }

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
      return { jobId: job.id, matchCount, lastCheckedAt: lastCheckedByJob.get(job.id) ?? null };
    });
}

export type SetMatchStatusResult = { ok: true } | { ok: false; reason: "not_an_employer" | "not_found" };

export async function setMatchStatus(jobId: string, candidateId: string, status: MatchStatus): Promise<SetMatchStatusResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const job = await getJobForEdit(jobId);
  if (!job || job.company_id !== ctx.company.id) return { ok: false, reason: "not_found" };

  const supabase = await createClient();
  const { error } = await supabase.from("candidate_match_notes").upsert(
    { company_id: ctx.company.id, job_id: jobId, candidate_id: candidateId, status, updated_at: new Date().toISOString() },
    { onConflict: "company_id,job_id,candidate_id" },
  );
  if (error) return { ok: false, reason: "not_found" };
  return { ok: true };
}

export type RegenerateMatchSummaryResult = { ok: true; data: MatchSummary } | { ok: false; reason: "not_found" | "generation_failed" };

/** Page 04's explicit "Generate/Regenerate AI summary" button — same
 *  not-automatic reasoning as `generateApplicantSynopsis`, one candidate
 *  at a time. */
export async function regenerateMatchSummary(jobId: string, candidateId: string): Promise<RegenerateMatchSummaryResult> {
  const detail = await getCandidateMatchDetail(jobId, candidateId);
  if (!detail.ok) return { ok: false, reason: "not_found" };

  const job = await getJobForEdit(jobId);
  if (!job) return { ok: false, reason: "not_found" };
  const tags = job.job_tech_tags.map((t) => ({ techTagId: t.tech_tag_id, required: t.required }));
  const tagLabels = await fetchTagLabels(tags.map((t) => t.techTagId));
  const jobFacts = jobFactsForPrompt(job, tagLabels);

  const result = await generateSingleMatchSummary(jobFacts, {
    candidateId,
    yearsExperience: detail.match.yearsExperience,
    skillLabels: detail.match.skillLabels,
    desiredSalary: detail.match.desiredSalary,
    preferredWorkModel: detail.match.preferredWorkModel,
    matchScore: detail.match.matchScore,
  });
  if (!result.ok) return result;

  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_found" };
  await cacheMatchSummaries(ctx.company.id, jobId, new Map([[candidateId, result.data]]));
  return { ok: true, data: result.data };
}
