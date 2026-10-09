import { generateText, Output } from "ai";
import { z } from "zod";

// Same model/reasoning as extract-cv.ts: a deliberate, employer-triggered
// action (reviewing one applicant), not high-volume traffic.
const MODEL = "anthropic/claude-sonnet-5.5";
const MAX_PROMPT_CHARS = 24_000;

export const ApplicantSynopsisSchema = z.object({
  summary: z.string(),
  // Only things genuinely present in the CV/cover note that line up with
  // the job — never invented, never generic ("good communicator") filler.
  strengths: z.array(z.string()),
  // Genuinely absent or mismatched against what the job asks for — e.g.
  // a required skill never mentioned, or clearly less seniority than the
  // role calls for. Never a guess at something the CV simply didn't
  // state one way or the other; empty array when nothing stands out.
  gaps: z.array(z.string()),
});

export type ApplicantSynopsis = z.infer<typeof ApplicantSynopsisSchema>;

export type ApplicantSynopsisResult =
  | { ok: true; data: ApplicantSynopsis }
  | { ok: false; reason: "empty_content" | "generation_failed" };

/**
 * Applicant detail view's "AI summary" (real-usage QA item) — a quick
 * read on fit, since an employer reviewing a stack of applicants had to
 * open and read every CV themselves before this. Deliberately NOT
 * generated automatically on every page view: an LLM call per applicant
 * per view would be real, ongoing cost for something most employers only
 * need once per candidate. Generated once on an explicit "Generate AI
 * summary" click and persisted to `applications.ai_synopsis` — see that
 * migration's own comment — with a manual "Regenerate" available if the
 * employer wants a fresh read later.
 *
 * Same "never invent" discipline as extract-cv.ts/extract-job.ts: the
 * model is told explicitly to ground every strength/gap in the actual
 * text, not plausible-sounding filler.
 */
export async function generateApplicantSynopsis(params: {
  jobTitle: string;
  jobDescription: string;
  cvText: string | null;
  coverNote: string | null;
}): Promise<ApplicantSynopsisResult> {
  const { jobTitle, jobDescription, cvText, coverNote } = params;

  const candidateContent = [
    cvText ? `CV text:\n${cvText}` : null,
    coverNote ? `Cover note:\n${coverNote}` : null,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (candidateContent.trim().length < 30) return { ok: false, reason: "empty_content" };

  const prompt =
    `You are helping an employer quickly assess one job applicant's fit for a role. ` +
    `Ground every statement in the actual text below — never invent a skill, a ` +
    `number of years, a qualification, or a gap the text doesn't actually support. ` +
    `"summary" is 2-3 plain sentences on overall fit for THIS role specifically, not ` +
    `a generic bio. "strengths" is an array of short, specific points — real ` +
    `qualifications/experience from the CV or cover note that line up with what the ` +
    `job asks for. "gaps" is an array of short, specific points — things the job ` +
    `asks for that are genuinely absent or that clearly fall short (e.g. a required ` +
    `skill never mentioned, notably less seniority than the role calls for); leave ` +
    `it an empty array if nothing stands out, rather than inventing a concern. ` +
    `Never pad either list with generic, could-apply-to-anyone filler.\n\n` +
    `Job title: ${jobTitle}\n\nJob description:\n${jobDescription.slice(0, 4000)}\n\n` +
    `--- Candidate ---\n${candidateContent.slice(0, MAX_PROMPT_CHARS)}`;

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: ApplicantSynopsisSchema }),
      prompt,
    });
    return { ok: true, data: output };
  } catch {
    return { ok: false, reason: "generation_failed" };
  }
}
