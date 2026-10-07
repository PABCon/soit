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
  techTagLabels: z.array(z.string()),
  requiredLanguages: z.array(
    z.object({
      label: z.string(),
      level: z.enum(["basic", "intermediate", "advanced", "expert"]).nullable(),
    }),
  ),
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
 * to invent numbers or tags. Deliberately never returns location/category —
 * an external posting's location text won't map cleanly onto the 14
 * curated Portuguese cities, and category is a judgment call better left
 * to the employer (§ plan). Tech-tag/language *labels* come back as plain
 * strings — the caller (JobForm) fuzzy-matches them against the real
 * vocab, so this never invents a new tag/language that doesn't exist.
 */
export async function extractJobFromUrl(url: string): Promise<ExtractJobResult> {
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
        `Page text:\n${text}`,
    });
    return { ok: true, data: output };
  } catch {
    return { ok: false, reason: "extraction_failed" };
  }
}
