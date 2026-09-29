import { generateText, Output } from "ai";
import { z } from "zod";

// Same model as extract-job.ts, same reasoning: a deliberate, rare user
// action (analyzing a CV), not high-volume traffic — extraction quality is
// worth more than the marginal cost. Always re-check
// https://ai-gateway.vercel.sh/v1/models before bumping this — never trust
// a remembered model id (per this project's AI SDK skill).
const MODEL = "anthropic/claude-sonnet-5.5";
const MAX_PROMPT_CHARS = 15_000;

const ExtractedCvSchema = z.object({
  headline: z.string().nullable(),
  yearsExperience: z.number().int().nullable(),
  skillLabels: z.array(z.string()),
  languages: z.array(
    z.object({
      label: z.string(),
      level: z.enum(["basic", "intermediate", "advanced", "expert"]).nullable(),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string().nullable(),
      fieldOfStudy: z.string().nullable(),
      // "yyyy-mm-dd" or null — the model is told to use the 1st of the month
      // when only a month/year is stated, never to invent a day it wasn't given.
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
  // §AI Pieces backlog, profile-depth phase — work history and
  // certifications, added after real-usage feedback that a detailed
  // profile came back thin without them. Company/institution/title names
  // aren't matched against any curated vocab (unlike skills/languages) —
  // free text, passed straight through.
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      description: z.string().nullable(),
    }),
  ),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string().nullable(),
      issuedDate: z.string().nullable(),
    }),
  ),
});

export type ExtractedCv = z.infer<typeof ExtractedCvSchema>;

export type ExtractCvResult =
  | { ok: true; data: ExtractedCv }
  | { ok: false; reason: "empty_content" | "extraction_failed" };

/**
 * §AI Pieces backlog, phase 2 — CV upload → profile autofill (collapses
 * original items 1+2: LinkedIn's own "Save to PDF" export is just another
 * CV document fed through this same parser, see plan). Takes already-
 * extracted plain text (the caller does PDF/DOCX → text via `unpdf`/
 * `mammoth`) rather than sending the raw file to the model — the installed
 * `ai` SDK does support a `messages` file-part shape for multimodal input,
 * but it's unverified whether this project's Gateway model-string routing
 * (no `@ai-sdk/anthropic` package installed) forwards it the same way as
 * the dedicated provider package. `extract-job.ts`'s plain-text-prompt
 * pattern is proven in production; reusing it is the lower-risk choice for
 * a feature that writes into a real candidate profile.
 *
 * Skill/language *labels* come back as plain strings — the caller fuzzy-
 * matches them against the real `tech_tags`/`spoken_languages` vocab, so
 * this never invents a new tag/language that doesn't exist (same contract
 * as `extractJobFromUrl`'s `techTagLabels`/`requiredLanguages`).
 */
export async function extractCvProfile(text: string): Promise<ExtractCvResult> {
  const trimmed = text.trim();
  if (trimmed.length < 50) return { ok: false, reason: "empty_content" };

  const prompt = trimmed.slice(0, MAX_PROMPT_CHARS);

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: ExtractedCvSchema }),
      prompt:
        "Extract profile fields from the CV text below. Only fill a field when it " +
        "is genuinely stated or clearly implied — leave it null (or an empty array) " +
        "if you are not confident. Never invent skills, languages, schools, or dates " +
        "that are not actually in the text. `headline` is a short current/target job " +
        "title (e.g. \"Senior Backend Engineer\"), not a summary paragraph. " +
        "`yearsExperience` is your best estimate of total professional experience in " +
        "years, from the work-history dates if present. For education/experience/" +
        "certification dates, use \"yyyy-mm-dd\" and default to the 1st of the month " +
        "when only a month/year is given — never invent a day. Leave an `endDate` null " +
        "when the entry is ongoing (a current job, an in-progress degree).\n\n" +
        `CV text:\n${prompt}`,
    });
    return { ok: true, data: output };
  } catch {
    return { ok: false, reason: "extraction_failed" };
  }
}
