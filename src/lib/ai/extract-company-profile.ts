import { generateText, Output } from "ai";
import { z } from "zod";
import { stripHtml } from "./strip-html";

// Sonnet, not Haiku — same reasoning as extract-job.ts: a deliberate, rare
// user action, not high-volume traffic, so extraction quality is worth
// more than the marginal cost difference. Always re-check
// https://ai-gateway.vercel.sh/v1/models before bumping this — never trust
// a remembered model id (per this project's AI SDK skill).
const MODEL = "anthropic/claude-sonnet-5.5";
const MAX_FETCH_BYTES = 2_000_000;
const MAX_PROMPT_CHARS = 15_000;
const FETCH_TIMEOUT_MS = 10_000;

const ExtractedCompanyProfileSchema = z.object({
  tagline: z.string().nullable(),
  aboutUs: z.string().nullable(),
  industry: z.string().nullable(),
  companySize: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  youtubeUrl: z.string().nullable(),
  tiktokUrl: z.string().nullable(),
  xUrl: z.string().nullable(),
});

export type ExtractedCompanyProfile = z.infer<typeof ExtractedCompanyProfileSchema>;

export type ExtractCompanyProfileResult =
  | { ok: true; data: ExtractedCompanyProfile; logoUrl: string | null }
  | {
      ok: false;
      reason: "invalid_url" | "fetch_failed" | "too_large" | "empty_content" | "extraction_failed";
    };

/**
 * Finds a logo candidate straight from the page's own markup — not an LLM
 * task: logos are reliably declared in a handful of standard meta/link
 * tags, so a deterministic regex search is both cheaper and more
 * trustworthy than asking a model to guess from stripped text. Checked in
 * priority order: the page's own Open Graph image (usually the most
 * "brand" image a site declares), then the two common favicon/touch-icon
 * tags. Relative URLs are resolved against the page's own URL.
 */
export function findLogoCandidate(html: string, baseUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i,
    /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']icon["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * "Autofill from website" (console company-profile settings) — fetches a
 * company's own homepage server-side, strips it to plain text (same blunt
 * tag-strip as job-URL extraction, not a readability library), and asks
 * the model to fill only the fields it's genuinely confident about — every
 * field is nullable, and the prompt explicitly forbids inventing anything.
 * Returns a suggestion payload only; nothing is written to the database
 * here — the console form prefills from it and the employer still
 * reviews/edits/saves normally (same UX as job-URL extraction).
 */
export async function extractCompanyProfileFromUrl(url: string): Promise<ExtractCompanyProfileResult> {
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

  const logoUrl = findLogoCandidate(html, parsed.toString());
  const text = stripHtml(html).slice(0, MAX_PROMPT_CHARS);
  if (text.length < 100) return { ok: false, reason: "empty_content" };

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: ExtractedCompanyProfileSchema }),
      prompt:
        "Extract company profile fields from this company's own website text below. " +
        "Only fill a field when it is genuinely stated or clearly implied — leave it " +
        "null if you are not confident. Never invent a social media URL, industry, or " +
        "company size that is not actually indicated by the text.\n\n" +
        "`tagline` should be a short (one sentence) description of what the company " +
        "does, suitable as a brief summary line. `aboutUs` should be a longer, " +
        "faithfully-formatted copy of the company's own \"about us\"-style narrative " +
        "where one exists — not a summary, keep the actual wording, just clean up " +
        "obvious extraction noise (stray whitespace, broken line wraps). Preserve " +
        "paragraph breaks (join with \\n). `industry` is a short phrase (e.g. " +
        "\"Software development\", \"Fintech\", \"E-commerce\"), not a long description. " +
        "`companySize` should only be filled if the page states a specific headcount " +
        "or range.\n\n" +
        `Page text:\n${text}`,
    });
    return { ok: true, data: output, logoUrl };
  } catch {
    return { ok: false, reason: "extraction_failed" };
  }
}
