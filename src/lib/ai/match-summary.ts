import { generateText, Output } from "ai";
import { z } from "zod";

// Round 26 (Matchmaking pages 03/04) — the "why matched" bullets and the
// AI summary panel, same `generateApplicantSynopsis`-style pattern
// (never invent, employer-triggered/cached rather than regenerated on
// every view) but with a real, extra constraint applicant-synopsis never
// needed: a match is *blinded*. The candidate's identity only unlocks
// when they reply to a message (messaging.ts's `sendMessage`), so this
// prompt must never let the model surface anything that could identify
// them — no real name (never given to it in the first place), no past/
// current employer or school name, nothing beyond the already-safe,
// already-blinded-compatible fields `candidate-matches.ts` selects
// (skills/years-of-experience/salary-expectation/work-model-preference)
// — deliberately never raw `candidate_experience` text, which could
// easily contain a real company name.
//
// `headline` is free text the candidate wrote themselves and — caught
// live, during this round's own verification, not guessed at — can
// contain exactly that kind of identifying text (e.g. "Senior Engineer
// at Acme Corp"); the model echoed it back verbatim on a real test case
// despite an explicit "never repeat a company name" instruction in the
// prompt. An instruction alone isn't a real guarantee, so `headline` is
// never sent to the model at all, not just asked to be handled
// carefully — removing the vector beats hoping the model honors a rule.
const MODEL = "anthropic/claude-sonnet-5.5";

const SUMMARY_SHAPE = {
  summary: z.string(),
  // Real, specific points grounded only in the facts given — never
  // generic filler, never a detail not present in those facts.
  strengths: z.array(z.string()),
  // 2-4 short bullets explaining the match itself (skill overlap,
  // preference alignment) — this is the list-page "why matched" copy.
  whyMatched: z.array(z.string()),
  // A short, GENERIC experience narrative (e.g. "Mainly in backend
  // development and financial-platform systems") — the reference design
  // (page 04) shows an "Experience" section, but the real per-role
  // `candidate_experience` text is deliberately never fetched here (it
  // can contain real company/institution names); this field exists
  // specifically so that section can show *something* real without ever
  // touching that table — grounded only in skill labels/years, and
  // explicitly forbidden below from naming any employer.
  experienceSummary: z.string(),
};

export const MatchSummarySchema = z.object(SUMMARY_SHAPE);
export type MatchSummary = z.infer<typeof MatchSummarySchema>;

const BatchResponseSchema = z.object({
  candidates: z.array(z.object({ candidateId: z.string(), ...SUMMARY_SHAPE })),
});

export type JobFactsForPrompt = {
  title: string;
  requiredSkillLabels: string[];
  niceToHaveSkillLabels: string[];
  categoryLabel: string | null;
  workModel: string;
  seniority: string;
};

export type CandidateFactsForPrompt = {
  candidateId: string;
  yearsExperience: number | null;
  skillLabels: string[];
  desiredSalary: { min: number; max: number; period: string } | null;
  preferredWorkModel: string | null;
  matchScore: number;
};

const PRIVACY_RULE =
  "CRITICAL — this candidate is anonymous to the employer: their identity only unlocks if THEY choose to reply to a " +
  "message. You are never given a real name, employer, school, or any other identifying detail — only skills, years " +
  "of experience, and stated preferences. Never invent or imply any identifying detail beyond that. Base every " +
  "statement only on the facts given below — never invent a skill, a number, or a detail not present in them.";

function jobFactsBlock(job: JobFactsForPrompt): string {
  return (
    `Job: ${job.title}\n` +
    `Seniority: ${job.seniority}\nWork model: ${job.workModel}\n` +
    (job.categoryLabel ? `Category: ${job.categoryLabel}\n` : "") +
    `Required skills: ${job.requiredSkillLabels.join(", ") || "(none specified)"}\n` +
    `Nice-to-have skills: ${job.niceToHaveSkillLabels.join(", ") || "(none specified)"}`
  );
}

function candidateFactsBlock(c: CandidateFactsForPrompt): string {
  return (
    `candidateId: ${c.candidateId}\n` +
    `Match score: ${c.matchScore}%\n` +
    (c.yearsExperience != null ? `Years of experience: ${c.yearsExperience}\n` : "") +
    `Skills: ${c.skillLabels.join(", ") || "(none listed)"}\n` +
    (c.preferredWorkModel ? `Preferred work model: ${c.preferredWorkModel}\n` : "") +
    (c.desiredSalary ? `Desired salary: ${c.desiredSalary.min}-${c.desiredSalary.max} ${c.desiredSalary.period}\n` : "")
  );
}

/** Batched — one call for every candidate on a job's match list that
 *  doesn't have a cached summary yet, not one call per candidate per
 *  page view. Callers cache the result (`candidate_match_notes.
 *  ai_summary`) so this only ever runs once per (job, candidate) pair
 *  until an employer explicitly regenerates one. */
export async function generateMatchSummaries(
  job: JobFactsForPrompt,
  candidates: CandidateFactsForPrompt[],
): Promise<Map<string, MatchSummary>> {
  if (candidates.length === 0) return new Map();

  const prompt =
    `You are explaining, for an employer, why each of several ANONYMOUS candidates matches a job — one JSON object ` +
    `per candidate, keyed by their candidateId. ${PRIVACY_RULE}\n\n` +
    `"summary" is 1-2 plain sentences on overall fit for this role. "strengths" is an array of short, specific ` +
    `points genuinely supported by the facts. "whyMatched" is an array of 2-4 short bullets naming the concrete ` +
    `reasons this candidate matched (e.g. specific overlapping required skills, years of experience vs. seniority, ` +
    `work-model/salary alignment). "experienceSummary" is ONE short, generic sentence describing the kind of work ` +
    `this person's skills/years suggest (e.g. "Mainly backend development and financial-platform systems") — never ` +
    `a specific employer, project, or institution name, since none is given to you anyway.` +
    `\n\n--- Job ---\n${jobFactsBlock(job)}\n\n--- Candidates ---\n\n` +
    candidates.map((c) => candidateFactsBlock(c)).join("\n---\n\n");

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: BatchResponseSchema }),
      prompt,
    });
    return new Map(
      output.candidates.map((c) => [
        c.candidateId,
        { summary: c.summary, strengths: c.strengths, whyMatched: c.whyMatched, experienceSummary: c.experienceSummary },
      ]),
    );
  } catch {
    return new Map();
  }
}

export type SingleMatchSummaryResult = { ok: true; data: MatchSummary } | { ok: false; reason: "generation_failed" };

/** Single-candidate regenerate, for page 04's "Regenerate" button —
 *  same privacy rule, just one candidate instead of a batch. */
export async function generateSingleMatchSummary(
  job: JobFactsForPrompt,
  candidate: CandidateFactsForPrompt,
): Promise<SingleMatchSummaryResult> {
  const prompt =
    `You are explaining, for an employer, why an ANONYMOUS candidate matches a job. ${PRIVACY_RULE}\n\n` +
    `"summary" is 1-2 plain sentences on overall fit for this role. "strengths" is an array of short, specific ` +
    `points genuinely supported by the facts. "whyMatched" is an array of 2-4 short bullets naming the concrete ` +
    `reasons this candidate matched. "experienceSummary" is ONE short, generic sentence describing the kind of ` +
    `work this person's skills/years suggest — never a specific employer, project, or institution name.` +
    `\n\n--- Job ---\n${jobFactsBlock(job)}\n\n--- Candidate ---\n${candidateFactsBlock(candidate)}`;

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: MatchSummarySchema }),
      prompt,
    });
    return { ok: true, data: output };
  } catch {
    return { ok: false, reason: "generation_failed" };
  }
}
