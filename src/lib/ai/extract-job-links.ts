import { generateText, Output } from "ai";
import { z } from "zod";
import { stripHtml } from "./strip-html";

// Same model choice as extract-job.ts, same reasoning — a deliberate, rare
// action (starting a bulk import), not high-volume traffic. Always
// re-check https://ai-gateway.vercel.sh/v1/models before bumping this.
const MODEL = "anthropic/claude-sonnet-5.5";
const MAX_FETCH_BYTES = 3_000_000;
const FETCH_TIMEOUT_MS = 10_000;
// A real listing page rarely has more candidate anchors than this even
// counting nav/footer/social noise — a hard cap keeps the classification
// prompt bounded regardless of how large or link-heavy the page is.
const MAX_CANDIDATES = 400;

type Candidate = { text: string; url: string };

/** Pulls every `<a href>` with visible text into a (text, absolute url)
 *  pair — deliberately NOT `stripHtml()`, which discards every tag
 *  (including the href it would otherwise be impossible to recover). This
 *  is the one place in the codebase that needs link targets, not just
 *  visible text, which is why it's a separate function from the existing
 *  text-only extraction used everywhere else. */
function extractAnchors(html: string, baseUrl: string): Candidate[] {
  const anchors: Candidate[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null && anchors.length < MAX_CANDIDATES) {
    const hrefRaw = match[1];
    if (/^(#|mailto:|tel:|javascript:)/i.test(hrefRaw)) continue;

    const text = stripHtml(match[2]).replace(/\s+/g, " ").trim();
    if (!text) continue;

    let url: string;
    try {
      url = new URL(hrefRaw, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    anchors.push({ text, url });
  }
  return anchors;
}

const LinkSelectionSchema = z.object({
  jobs: z.array(
    z.object({
      // The candidate's own position in the numbered list the prompt
      // gives it — resolving the real URL by index afterward means the
      // model never has to transcribe a URL itself, so there's no way
      // for it to return a subtly-wrong link.
      index: z.number(),
      title: z.string().nullable(),
    }),
  ),
});

export type DiscoveredJobLink = { url: string; title: string | null };

export type ExtractJobLinksResult =
  | { ok: true; links: DiscoveredJobLink[] }
  | { ok: false; reason: "invalid_url" | "fetch_failed" | "too_large" | "empty_content" | "extraction_failed" };

/**
 * §job-import — given a careers/jobs *listing* page, finds the individual
 * job-posting links on it, in page order (the best available proxy for
 * "newest first," since there's no universal posted-date to sort by).
 * Deliberately conservative: only a server-rendered listing can be seen at
 * all — a JS-rendered SPA career board returns an empty/near-empty page to
 * a plain fetch, and this returns `empty_content` for that case rather
 * than pretending to find jobs that were never really there. Works best
 * for simple sites and common ATS-hosted boards (Greenhouse, Lever,
 * Workday, Ashby, …), whose listings are generally present in the raw
 * HTML even when the rest of the page is JS-heavy.
 */
export async function extractJobLinksFromUrl(url: string): Promise<ExtractJobLinksResult> {
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

  const candidates = extractAnchors(html, parsed.toString());
  if (candidates.length === 0) return { ok: false, reason: "empty_content" };

  const listText = candidates.map((c, i) => `${i}: "${c.text}" -> ${c.url}`).join("\n");

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: LinkSelectionSchema }),
      prompt:
        "Below is a numbered list of every link found on a company's careers/jobs listing page, " +
        "as \"index: \\\"link text\\\" -> url\". Identify which of these links point to an " +
        "INDIVIDUAL job posting (a specific open role a candidate could apply to) — not " +
        "navigation, \"About us\", \"Contact\", pagination controls, social media, login/" +
        "account links, or anything else that isn't one specific job. " +
        "Return them in the same order they appear in the list (top to bottom), which is the " +
        "best available signal for newest-first on most listing pages. For `title`, use the " +
        "link's own text if it reads like a real job title, otherwise null — never invent one. " +
        "If genuinely none of these links are job postings, return an empty array.\n\n" +
        `${listText}`,
    });
    const links = output.jobs
      .filter((j) => j.index >= 0 && j.index < candidates.length)
      .map((j) => ({ url: candidates[j.index].url, title: j.title }));
    return { ok: true, links };
  } catch {
    return { ok: false, reason: "extraction_failed" };
  }
}
