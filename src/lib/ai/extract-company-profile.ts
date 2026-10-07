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
const MAX_PAGE_PROMPT_CHARS = 10_000;
const FETCH_TIMEOUT_MS = 10_000;

// Social fields are no longer part of the LLM schema — see findSocialLinks
// below. stripHtml() deletes every tag (hence every href attribute) before
// the model ever sees the text, so an LLM could only ever find a social URL
// if it happened to appear as plain visible text, which is rare — nearly
// every real site links these as bare icon hrefs. A deterministic scan of
// the raw HTML's own href attributes is both more reliable and cheaper.
const LlmFieldsSchema = z.object({
  tagline: z.string().nullable(),
  aboutUs: z.string().nullable(),
  industry: z.string().nullable(),
  companySize: z.string().nullable(),
});

export type ExtractedCompanyProfile = z.infer<typeof LlmFieldsSchema> &
  Record<"facebookUrl" | "linkedinUrl" | "instagramUrl" | "youtubeUrl" | "tiktokUrl" | "xUrl", string | null>;

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

type SocialKey = "facebookUrl" | "linkedinUrl" | "instagramUrl" | "youtubeUrl" | "tiktokUrl" | "xUrl";

// Each pattern deliberately excludes the share/intent/sharer paths every
// platform offers for "share this page" buttons — those are links to the
// *current page*, not to the company's own social profile, and would
// otherwise be the most common false positive on a real homepage.
const SOCIAL_PATTERNS: Record<SocialKey, RegExp> = {
  facebookUrl: /https?:\/\/(?:www\.)?facebook\.com\/(?!sharer|share\.php|dialog|tr\?|plugins)[A-Za-z0-9_.\-]+\/?/i,
  linkedinUrl: /https?:\/\/(?:www\.)?linkedin\.com\/company\/[A-Za-z0-9_\-]+\/?/i,
  instagramUrl: /https?:\/\/(?:www\.)?instagram\.com\/(?!sharer|share)[A-Za-z0-9_.\-]+\/?/i,
  youtubeUrl:
    /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|c\/|user\/|@)?(?!watch|embed|results|playlist|shorts)[A-Za-z0-9_\-]+\/?/i,
  tiktokUrl: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.\-]+\/?/i,
  xUrl: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!share|intent|hashtag)[A-Za-z0-9_]+\/?/i,
};

/**
 * Finds the company's own social profile links straight from the raw
 * HTML's href attributes — deterministic, not an LLM task (and couldn't be
 * one here: by the time the page is stripped to plain text for the model,
 * every href is already gone, so the model would only ever see a social
 * URL if it happened to appear as visible text, which real sites almost
 * never do — they link icons, not URLs). Takes the first plausible match
 * per platform.
 */
export function findSocialLinks(html: string): Partial<Record<SocialKey, string>> {
  const hrefs = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
  const result: Partial<Record<SocialKey, string>> = {};

  for (const key of Object.keys(SOCIAL_PATTERNS) as SocialKey[]) {
    const pattern = SOCIAL_PATTERNS[key];
    const match = hrefs.find((href) => pattern.test(href));
    if (match) result[key] = match.match(pattern)![0];
  }
  return result;
}

/**
 * Finds a same-site "About us"-style page linked from the homepage, so the
 * company-size/about-text extraction has a real second source to work
 * from — a marketing homepage rarely states headcount or a proper company
 * narrative, but a dedicated About/Team page often does. Deterministic:
 * looks for a link whose href or visible text matches common About-page
 * wording, same origin only (never follows off-site links), and never the
 * homepage itself.
 */
export function findAboutPageUrl(html: string, baseUrl: string): string | null {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return null;
  }

  const keywords = /about|sobre|empresa|quem-somos|company|team|equipa|who-we-are/i;
  const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, " ");
    if (!keywords.test(href) && !keywords.test(text)) continue;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin !== origin) continue;
      if (resolved.pathname === "/" || resolved.pathname === "") continue;
      return resolved.toString();
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JustITBot/1.0; +https://justit.pt)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_FETCH_BYTES) return null;
    const html = new TextDecoder().decode(buf);
    return stripHtml(html).slice(0, MAX_PAGE_PROMPT_CHARS);
  } catch {
    return null;
  }
}

/**
 * "Autofill from website" (console company-profile settings) — fetches a
 * company's own homepage server-side (and, best-effort, a linked About
 * page too, for richer about-us/size signal), extracts logo and social
 * links deterministically from the raw markup, and asks the model to fill
 * only the text fields it's genuinely confident about — every field is
 * nullable, and the prompt explicitly forbids inventing anything. Returns
 * a suggestion payload only; nothing is written to the database here — the
 * console form prefills from it and the employer still reviews/edits/
 * saves normally (same UX as job-URL extraction).
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
  const socials = findSocialLinks(html);
  const homepageText = stripHtml(html).slice(0, MAX_PAGE_PROMPT_CHARS);
  if (homepageText.length < 100) return { ok: false, reason: "empty_content" };

  // Best-effort second source — a failure here just means we proceed with
  // the homepage alone, never a hard failure for the whole request.
  const aboutUrl = findAboutPageUrl(html, parsed.toString());
  const aboutText = aboutUrl && aboutUrl !== parsed.toString() ? await fetchPageText(aboutUrl) : null;

  const pageText = aboutText
    ? `Homepage text:\n${homepageText}\n\nAbout page text:\n${aboutText}`
    : `Homepage text:\n${homepageText}`;

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: LlmFieldsSchema }),
      prompt:
        "Extract company profile fields from this company's own website text below " +
        "(the homepage, and an About/Team page if one was found). Only fill a field " +
        "when it is genuinely stated or clearly implied — leave it null if you are " +
        "not confident. Never invent an industry or company size that is not " +
        "actually indicated by the text.\n\n" +
        "`tagline` should be a short (one sentence) description of what the company " +
        "does, suitable as a brief summary line. `aboutUs` should be a longer, " +
        "faithfully-formatted copy of the company's own \"about us\"-style narrative " +
        "where one exists — not a summary, keep the actual wording, just clean up " +
        "obvious extraction noise (stray whitespace, broken line wraps). Preserve " +
        "paragraph breaks (join with \\n). `industry` is a short phrase (e.g. " +
        "\"Software development\", \"Fintech\", \"E-commerce\"), not a long " +
        "description. `companySize` should only be filled from an explicit " +
        "statement of headcount or a range (e.g. \"50+ employees\", \"a team of " +
        "20\", \"mais de 100 colaboradores\", \"11-50 employees\") — not guessed " +
        "from anything else on the page (e.g. number of office locations, funding " +
        "amount, or how many people appear in a team photo).\n\n" +
        `${pageText}`,
    });
    return {
      ok: true,
      data: {
        ...output,
        facebookUrl: socials.facebookUrl ?? null,
        linkedinUrl: socials.linkedinUrl ?? null,
        instagramUrl: socials.instagramUrl ?? null,
        youtubeUrl: socials.youtubeUrl ?? null,
        tiktokUrl: socials.tiktokUrl ?? null,
        xUrl: socials.xUrl ?? null,
      },
      logoUrl,
    };
  } catch {
    return { ok: false, reason: "extraction_failed" };
  }
}
