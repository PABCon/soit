import { generateText, Output } from "ai";
import { z } from "zod";
import { stripHtml } from "./strip-html";

// Sonnet, not Haiku — this only ever runs on a deliberate, rare user action
// (posting a new job), not high-volume traffic, so extraction quality is
// worth more here than the marginal cost difference. Always re-check
// https://ai-gateway.vercel.sh/v1/models before bumping this — never trust
// a remembered model id (per this project's AI SDK skill).
const MODEL = "anthropic/claude-sonnet-5.5";
const MAX_FETCH_BYTES = 2_000_000;
const MAX_PROMPT_CHARS = 15_000;
const FETCH_TIMEOUT_MS = 10_000;

const ExtractedJobSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  seniority: z.enum(["junior", "mid", "senior", "lead"]).nullable(),
  workModel: z.enum(["remote", "hybrid", "office"]).nullable(),
  employmentType: z.enum(["permanent", "fixed_term", "contractor", "freelance", "internship"]).nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  salaryPeriod: z.enum(["hour", "day", "month", "year"]).nullable(),
  adLanguage: z.enum(["pt", "en"]).nullable(),
  // Real-usage report — "why isn't the expertise level estimated from the
  // job description?" A flat label list had nowhere to carry that.
  // `required` separates a posting's "must-have" stack from its "nice to
  // have/bonus" one — both real, common sections in a job ad; `level`
  // only when the text actually implies a seniority/years-of-experience
  // bar for that specific technology, not a guess.
  techStack: z.array(
    z.object({
      label: z.string(),
      level: z.enum(["basic", "intermediate", "advanced", "expert"]).nullable(),
      required: z.boolean(),
    }),
  ),
  requiredLanguages: z.array(
    z.object({
      label: z.string(),
      level: z.enum(["basic", "intermediate", "advanced", "expert"]).nullable(),
    }),
  ),
  // Real-usage report pushed back on the original "never return these"
  // design (an external posting's free-text location/category can't map
  // cleanly onto a fixed vocab) — the fix isn't to keep refusing, it's to
  // apply the exact same trusted pattern tech tags already use: the model
  // picks the closest match from the *exact* list it's given in the
  // prompt (see buildCategoryList/buildLocationList below), the caller
  // matches the returned label verbatim against the real vocab, and a
  // non-match is silently dropped rather than invented. Only populated
  // when the caller actually passes a vocab to match against.
  categoryLabel: z.string().nullable(),
  locationLabel: z.string().nullable(),
});

export type ExtractedJob = z.infer<typeof ExtractedJobSchema>;

export type ExtractJobResult =
  | { ok: true; data: ExtractedJob }
  | {
      ok: false;
      reason: "invalid_url" | "fetch_failed" | "too_large" | "empty_content" | "extraction_failed";
    };

/**
 * Item 10a (§ real-usage QA, employer-console review) — "paste a job link,
 * auto-fill the form." Fetches the page server-side, strips it down to
 * plain text (no readability library — a blunt tag-strip is enough for an
 * LLM prompt, unlike a human-facing reader view), and asks the model to
 * fill only the fields it's genuinely confident about — every field is
 * nullable/optional in the schema, and the prompt explicitly tells it not
 * to invent numbers or tags. Tech-tag/language/category/location *labels*
 * come back as plain strings — the caller (JobForm) matches them against
 * the real vocab, so this never invents a new tag/language/category/city
 * that doesn't exist.
 */
export async function extractJobFromUrl(
  url: string,
  vocab?: { categoryLabels?: string[]; locationNames?: string[] },
): Promise<ExtractJobResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "invalid_url" };
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JustITBot/1.0; +https://justit.pt)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, reason: "fetch_failed" };

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_FETCH_BYTES) return { ok: false, reason: "too_large" };
    html = new TextDecoder().decode(buf);
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }

  const text = stripHtml(html).slice(0, MAX_PROMPT_CHARS);
  if (text.length < 100) return { ok: false, reason: "empty_content" };

  const categoryInstruction = vocab?.categoryLabels?.length
    ? `\n\n\`categoryLabel\`: if the posting's role clearly fits one of these categories, return that ` +
      `category's exact text (copy it verbatim) — otherwise null. Do not guess at a close-enough fit; ` +
      `only return one if it's a genuine match. Categories:\n${vocab.categoryLabels.map((c) => `- ${c}`).join("\n")}`
    : "";
  const locationInstruction = vocab?.locationNames?.length
    ? `\n\n\`locationLabel\`: if the posting states an office/on-site location that is clearly one of ` +
      `these cities, return that city's exact text (copy it verbatim) — otherwise null (including for ` +
      `fully remote roles, or a location not in this list). Cities:\n${vocab.locationNames.map((c) => `- ${c}`).join("\n")}`
    : "";

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: ExtractedJobSchema }),
      prompt:
        "Extract job posting fields from the page text below. Only fill a field " +
        "when it is genuinely stated or clearly implied — leave it null (or an " +
        "empty array) if you are not confident. Never invent salary numbers, " +
        "technologies, or languages that are not actually in the text.\n\n" +
        "`description` should be a close, faithfully-formatted copy of the " +
        "posting's own description — not a summary. Keep the actual wording; " +
        "only clean up obvious extraction noise (stray whitespace, broken line " +
        "wraps). Preserve the source's own structure: separate paragraphs and " +
        "list items (e.g. a Requirements/Responsibilities/Benefits list) onto " +
        "their own lines (join with \\n), each list item starting with \"- \". " +
        "Do not merge multiple bullet points into one run-on sentence, and do " +
        "not drop items the posting lists.\n\n" +
        "`techStack`: `required: true` for technologies listed under a " +
        "\"requirements\"/\"must-have\"/\"you have\" style section, " +
        "`required: false` for a \"nice to have\"/\"bonus\"/\"preferred\" " +
        "section. Only set `level` when the text ties a specific seniority " +
        "or years-of-experience bar to that specific technology (e.g. " +
        "\"5+ years of React\" → advanced/expert; \"familiarity with " +
        "Docker\" → basic) — leave it null rather than guess from the " +
        "role's overall seniority.\n\n" +
        `${categoryInstruction}${locationInstruction}\n\n` +
        `Page text:\n${text}`,
    });
    return { ok: true, data: output };
  } catch {
    return { ok: false, reason: "extraction_failed" };
  }
}
