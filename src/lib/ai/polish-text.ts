import { generateText } from "ai";

// Same model/reasoning as extract-job.ts and extract-cv.ts — a deliberate,
// rare user action, not high-volume traffic.
const MODEL = "anthropic/claude-sonnet-5.5";
const MAX_INPUT_CHARS = 8_000;

export type PolishResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty_content" | "too_long" | "polish_failed" };

/**
 * "Polish with AI" (§ real-usage QA — job-description formatting): for a
 * job description an employer typed or pasted themselves (as opposed to
 * `extractJobFromUrl`'s fetched-from-a-link path), reformats it into
 * clean, well-structured text — proper paragraphs and bullet lists where
 * the content is already list-shaped — without rewriting the employer's
 * own content. Explicitly a *formatting* pass, not a rewrite: the prompt
 * forbids adding, removing, or changing the meaning of anything, exactly
 * the same "never invent" discipline as every other LLM feature in this
 * codebase, just aimed at structure instead of new fields. Plain
 * `generateText` (not `Output.object`) since the result is a single
 * string, not structured data.
 */
export async function polishJobDescription(text: string): Promise<PolishResult> {
  const trimmed = text.trim();
  if (trimmed.length < 20) return { ok: false, reason: "empty_content" };
  if (trimmed.length > MAX_INPUT_CHARS) return { ok: false, reason: "too_long" };

  try {
    const { text: output } = await generateText({
      model: MODEL,
      prompt:
        "Reformat the job description below into clean, well-structured text. " +
        "This is a formatting pass only: do not add, remove, or change the " +
        "meaning of any requirement, responsibility, benefit, or other detail — " +
        "keep the employer's own wording. Fix only obvious typos and stray " +
        "whitespace from pasting. Organize into clear paragraphs, and turn any " +
        "list-shaped content (requirements, responsibilities, benefits, tech " +
        "stack, etc.) into a bullet list, one item per line starting with " +
        "\"- \". Separate paragraphs and lists with a blank line. Output only " +
        "the reformatted description text, nothing else — no preamble, no " +
        "explanation, no markdown headings.\n\n" +
        `Description:\n${trimmed}`,
    });
    const polished = output.trim();
    if (!polished) return { ok: false, reason: "polish_failed" };
    return { ok: true, text: polished };
  } catch {
    return { ok: false, reason: "polish_failed" };
  }
}
