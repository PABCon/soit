import { generateText, Output } from "ai";
import { z } from "zod";
import { stripHtml } from "./strip-html";
import { safeFetch } from "../safe-fetch";

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
// Real-usage finding: many company career pages paginate ("page 2", "older
// roles", …) and the single-page version of this function silently missed
// every job past page 1. Bounds total latency/LLM calls regardless of how
// many pages a site claims to have — each page is a sequential fetch + LLM
// call (page N+1 can't be discovered before page N's response says where it
// is), and this whole crawl runs synchronously inside one Server Action
// call with no extended timeout, so it can't grow unbounded. A career page
// with more than this many pages of open roles is a genuine edge case the
// caller is told about (`truncated: true`) rather than one silently
// swallowed.
const MAX_PAGES = 10;

type Candidate = { text: string; url: string };

/** Pulls every `<a href>` with visible text into a (text, absolute url)
 *  pair — deliberately NOT `stripHtml()`, which discards every tag
 *  (including the href it would otherwise be impossible to recover). This
 *  is the one place in the codebase that needs link targets, not just
 *  visible text, which is why it's a separate function from the existing
 *  text-only extraction used everywhere else. */
export function extractAnchors(html: string, baseUrl: string): Candidate[] {
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

/** Resolves the model's chosen `nextPageIndex` into a real URL to crawl
 *  next — bounds-checked against this page's own candidate list, and never
 *  the current page's own URL or one already visited earlier in this same
 *  crawl (guards against a pagination widget that links back to itself, or
 *  a site whose "next" link cycles, turning what should be a bounded crawl
 *  into an infinite one). */
export function resolveNextPageUrl(
  candidates: Candidate[],
  nextPageIndex: number | null,
  currentUrl: string,
  visited: ReadonlySet<string>,
): string | null {
  if (nextPageIndex === null) return null;
  const candidate = candidates[nextPageIndex];
  if (!candidate) return null;
  if (candidate.url === currentUrl) return null;
  if (visited.has(candidate.url)) return null;
  return candidate.url;
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
  // Index of a link to a FURTHER page of more job listings beyond this one
  // (page 2, "older roles", a `rel=next`-style control) — null if this page
  // has no more pages. A JS-only "Load more" button with no real `href`
  // never appears in the candidate list at all (extractAnchors only sees
  // real anchors), so it's naturally excluded rather than needing its own
  // instruction here.
  nextPageIndex: z.number().nullable(),
});

export type DiscoveredJobLink = { url: string; title: string | null };

export type ExtractJobLinksResult =
  | {
      ok: true;
      links: DiscoveredJobLink[];
      /** True when the crawl stopped for a reason OTHER than the listing
       *  itself running out of pages — hit `MAX_PAGES`, or a later page
       *  (not the first) failed to fetch/parse. The caller should tell the
       *  employer honestly that more jobs may exist beyond what's here,
       *  rather than implying this is definitely the complete list. */
      truncated: boolean;
    }
  | { ok: false; reason: "invalid_url" | "fetch_failed" | "too_large" | "empty_content" | "extraction_failed" };

type PageFetchResult = { ok: true; html: string } | { ok: false; reason: "fetch_failed" | "too_large" };

async function fetchJobListingPage(url: string): Promise<PageFetchResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    // SSRF defense (security audit finding): this is the one fetch every
    // page of the crawl goes through — including pages discovered from a
    // prior page's own "next page"/job links, not just the URL the
    // caller originally supplied. safeFetch re-validates the destination
    // (and every redirect hop) on each call, so a malicious page can't
    // plant a link pointing at an internal address and have it followed.
    const result = await safeFetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JustITBot/1.0; +https://justit.pt)" },
    });
    clearTimeout(timeout);
    if (!result.ok) return { ok: false, reason: "fetch_failed" };
    if (!result.response.ok) return { ok: false, reason: "fetch_failed" };

    const buf = await result.response.arrayBuffer();
    if (buf.byteLength > MAX_FETCH_BYTES) return { ok: false, reason: "too_large" };
    return { ok: true, html: new TextDecoder().decode(buf) };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
}

type PageOutcome =
  | { ok: true; jobs: DiscoveredJobLink[]; nextPageUrl: string | null }
  | { ok: false; reason: "fetch_failed" | "too_large" | "empty_content" | "extraction_failed" };

async function discoverJobsOnPage(url: string, visited: ReadonlySet<string>): Promise<PageOutcome> {
  const fetched = await fetchJobListingPage(url);
  if (!fetched.ok) return fetched;

  const candidates = extractAnchors(fetched.html, url);
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
        "Also check for pagination: if one of these links leads to a FURTHER page of MORE job " +
        "listings beyond what's shown here (e.g. \"Next\", \"Seguinte\", \"»\", \"Older " +
        "roles\", a numbered link to the next page) — as opposed to a link to an unrelated " +
        "section of the site — return its index as `nextPageIndex`; otherwise null. Never choose " +
        "a link that leads anywhere other than more of this same job listing.\n\n" +
        `${listText}`,
    });
    const jobs = output.jobs
      .filter((j) => j.index >= 0 && j.index < candidates.length)
      .map((j) => ({ url: candidates[j.index].url, title: j.title }));
    const nextPageUrl = resolveNextPageUrl(candidates, output.nextPageIndex, url, visited);
    return { ok: true, jobs, nextPageUrl };
  } catch {
    return { ok: false, reason: "extraction_failed" };
  }
}

/**
 * §job-import — given a careers/jobs *listing* page, finds the individual
 * job-posting links on it (and, when the listing paginates, on up to
 * `MAX_PAGES` further pages reachable from a real "next page"-style link),
 * in page order (the best available proxy for "newest first," since
 * there's no universal posted-date to sort by). Deliberately conservative:
 * only a server-rendered listing can be seen at all — a JS-rendered SPA
 * career board returns an empty/near-empty page to a plain fetch, and this
 * returns `empty_content` for that case rather than pretending to find jobs
 * that were never really there. Works best for simple sites and common
 * ATS-hosted boards (Greenhouse, Lever, Workday, Ashby, …), whose listings
 * are generally present in the raw HTML even when the rest of the page is
 * JS-heavy. A later page failing to fetch or parse just stops the crawl
 * where it is — whatever was already found on earlier pages still stands;
 * only the very first page's failure is this whole call's own failure,
 * same contract as before pagination support existed. Either way (hitting
 * `MAX_PAGES`, or a later page failing), the result's `truncated` flag
 * tells the caller more jobs may genuinely exist beyond what was found,
 * rather than silently implying this is the complete list.
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

  const visited = new Set<string>();
  const seenJobUrls = new Set<string>();
  const links: DiscoveredJobLink[] = [];
  let currentUrl: string | null = parsed.toString();
  let pageCount = 0;
  let truncated = false;

  while (currentUrl) {
    if (pageCount >= MAX_PAGES) {
      truncated = true;
      break;
    }
    visited.add(currentUrl);
    const page = await discoverJobsOnPage(currentUrl, visited);
    pageCount++;
    if (!page.ok) {
      if (pageCount === 1) return { ok: false, reason: page.reason };
      truncated = true;
      break;
    }
    for (const link of page.jobs) {
      if (seenJobUrls.has(link.url)) continue;
      seenJobUrls.add(link.url);
      links.push(link);
    }
    currentUrl = page.nextPageUrl;
  }

  return { ok: true, links, truncated };
}
