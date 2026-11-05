import { generateText, Output } from "ai";
import { z } from "zod";

// Same model/reasoning as extract-cv.ts and applicant-synopsis.ts: a
// deliberate, rare user action (reviewing one CV), not high-volume
// traffic — extraction quality is worth more than the marginal cost.
const MODEL = "anthropic/claude-sonnet-5.5";
const MAX_PROMPT_CHARS = 24_000;

const SectionSchema = z.object({
  score: z.number().int().min(0).max(100),
  // One short, specific sentence on what's driving this section's score —
  // never generic filler, always grounded in what the CV actually does or
  // doesn't do.
  note: z.string(),
});

export const CvQualityScoreSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  sections: z.object({
    // Is the CV organized so a recruiter can scan it in 30 seconds —
    // clear headings, reverse-chronological, no walls of text?
    structure: SectionSchema,
    // Does it describe outcomes/impact (numbers, scope, results), or just
    // list responsibilities and tech names?
    impact: SectionSchema,
    // Contact info, a full work history with dates, education — the
    // basics a recruiter needs to act on it at all.
    completeness: SectionSchema,
  }),
  // Specific, real things the CV already does well — never generic
  // praise ("well organized") unless the text genuinely demonstrates it.
  strengths: z.array(z.string()),
  // Specific, actionable fixes — what to add, cut, or rewrite, and why.
  // Never vague ("improve formatting") — each point should be something
  // the candidate could actually act on today.
  improvements: z.array(z.string()),
});

export type CvQualityScore = z.infer<typeof CvQualityScoreSchema>;

export type CvQualityScoreResult =
  | { ok: true; data: CvQualityScore }
  | { ok: false; reason: "empty_content" | "generation_failed" };

/**
 * The public "upload your CV, get scored" growth loop's AI core — scores
 * a CV generally, against what makes a strong CV for the Portuguese IT job
 * market, deliberately NOT against any specific job posting (that's a
 * separate, later "tailor to this job" feature that reuses this same
 * engine against a job description instead). Same "ground every claim in
 * the actual text, never invent" discipline as extract-cv.ts/
 * applicant-synopsis.ts.
 */
export async function scoreCvQuality(cvText: string): Promise<CvQualityScoreResult> {
  if (cvText.trim().length < 30) return { ok: false, reason: "empty_content" };

  const prompt =
    `You are an expert IT recruiter in Portugal, reviewing a candidate's CV and scoring ` +
    `its quality as a document — not the candidate's career itself, just how well the CV ` +
    `presents them. Score three sections (0-100 each, plus one short grounded note per ` +
    `section): "structure" (can a recruiter scan this in 30 seconds — clear headings, ` +
    `reverse-chronological order, no walls of unbroken text), "impact" (does it describe ` +
    `outcomes and results with real specifics, or just list responsibilities/tech names), ` +
    `and "completeness" (contact info, a full work history with dates, education). ` +
    `"overallScore" is your holistic 0-100 judgment, not a mechanical average of the three. ` +
    `"strengths" and "improvements" must each be grounded in the actual text — never ` +
    `generic praise or generic advice; every point should be specific enough that the ` +
    `candidate immediately knows what you mean and could act on it today. Never invent ` +
    `anything the CV doesn't actually show.\n\n` +
    `CV text:\n${cvText.slice(0, MAX_PROMPT_CHARS)}`;

  try {
    const { output } = await generateText({
      model: MODEL,
      prompt,
      output: Output.object({ schema: CvQualityScoreSchema }),
    });
    return { ok: true, data: output };
  } catch (err) {
    console.error("scoreCvQuality failed:", err);
    return { ok: false, reason: "generation_failed" };
  }
}
