import { generateText, Output } from "ai";
import { z } from "zod";

// Same model as extract-job.ts, same reasoning: a deliberate, rare user
// action (analyzing a CV), not high-volume traffic — extraction quality is
// worth more than the marginal cost. Always re-check
// https://ai-gateway.vercel.sh/v1/models before bumping this — never trust
// a remembered model id (per this project's AI SDK skill).
const MODEL = "anthropic/claude-sonnet-5.5";
// Bumped from 15k after real-usage feedback: a genuinely detailed,
// multi-role CV can run long, and truncating it mid-history silently
// thins out exactly the content candidates most want captured.
const MAX_PROMPT_CHARS = 24_000;

const ExtractedCvSchema = z.object({
  // Real-usage feedback: never extracted at all before, even though a
  // CV's header block almost always states these — a candidate shouldn't
  // have to retype what's already right there.
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
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
      // A short narrative intro *only* if the CV actually writes one in
      // prose — most roles won't have this; leave null rather than
      // inventing a summary from the highlights.
      description: z.string().nullable(),
      // Real-usage feedback: the first version of this prompt let the
      // model compress a role's own detailed bullet points into one
      // short, semicolon-joined sentence — worse than what the CV
      // actually said, and even once fixed to preserve them as "- "
      // lines, that's still not a real structured shape for a UI (or a
      // future CV export) to render as actual bullets. Each
      // responsibility/achievement is now its own array element instead.
      highlights: z.array(z.string()),
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
 * as `extractJobFromUrl`'s `techStack`/`requiredLanguages`).
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
        "if you are not confident. Never invent skills, languages, schools, names, " +
        "contact details, or dates that are not actually in the text. `fullName`/" +
        "`phone`/`linkedinUrl` usually appear in the CV's own header block. " +
        "`headline` is a short current/target job title (e.g. \"Senior Backend " +
        "Engineer\"), not a summary paragraph. `yearsExperience` is your best " +
        "estimate of total professional experience in years, from the work-history " +
        "dates if present. For education/experience/certification dates, use " +
        "\"yyyy-mm-dd\" and default to the 1st of the month when only a month/year " +
        "is given — never invent a day. Leave an `endDate` null when the entry is " +
        "ongoing (a current job, an in-progress degree).\n\n" +
        "For each `experience` entry: `highlights` is an array with one array " +
        "element per responsibility/achievement/bullet point the CV lists for " +
        "that role — reproduce the actual detail and wording, do not compress " +
        "multiple points into one, do not drop any the CV lists, and do not " +
        "add a leading \"-\" or bullet character (the array structure already " +
        "represents that). Only shorten wording that is genuinely redundant " +
        "(e.g. repeated boilerplate) — never shorten to save space. `description` " +
        "is a separate, short narrative intro sentence — only fill it if the CV " +
        "itself writes one in prose *before* its bullet points; leave it null " +
        "when the role is just a bullet list, rather than inventing a summary " +
        "of the highlights. If a role genuinely has no detail at all in the " +
        "source (a bare title/company/dates line), leave both `description` " +
        "null and `highlights` an empty array rather than inventing content.\n\n" +
        `CV text:\n${prompt}`,
    });
    return { ok: true, data: output };
  } catch {
    return { ok: false, reason: "extraction_failed" };
  }
}
