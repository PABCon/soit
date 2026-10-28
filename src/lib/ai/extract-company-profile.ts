import { generateText, Output } from "ai";
import { z } from "zod";
import { stripHtml } from "./strip-html";
import { safeFetch } from "../safe-fetch";

// Sonnet, not Haiku — same reasoning as extract-job.ts: a deliberate, rare
// user action, not high-volume traffic, so extraction quality is worth
// more than the marginal cost difference. Always re-check
// https://ai-gateway.vercel.sh/v1/models before bumping this — never trust
// a remembered model id (per this project's AI SDK skill).
const MODEL = "anthropic/claude-sonnet-5.5";
const MAX_FETCH_BYTES = 2_000_000;
const MAX_SITEMAP_BYTES = 1_500_000;
// Raised from the original 10,000 — real-usage finding: fetching more than
// just the homepage + one About page (below) meant the old cap was cutting
// real benefits/careers content short more often than it used to.
const MAX_PAGE_PROMPT_CHARS = 14_000;
// Beyond the homepage itself — bounds both latency (every extra page is
// fetched in parallel, so this caps worst-case wall time, not a multiple of
// it) and prompt size, regardless of how many candidate pages a real site
// happens to have.
const MAX_EXTRA_PAGES = 4;
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
  // Real-usage finding: the original single-page (homepage + one About
  // page) version never found a company's actual Benefits/Careers content,
  // since it never looked for those pages at all — these three only became
  // fillable once the multi-page crawl below started seeking them out.
  benefitsText: z.string().nullable(),
  howWeWorkText: z.string().nullable(),
  address: z.string().nullable(),
  teamMembers: z.array(z.object({ name: z.string(), role: z.string().nullable() })),
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

type PageCategory = "about" | "careers" | "benefits" | "contact";

// One keyword set per category a real company site is likely to have as a
// distinct page — "about" also catches "team", since on a small site
// they're very often the same page. Categories aren't mutually exclusive on
// purpose: a Careers page commonly states benefits too, and that's fine —
// the model reads whatever text it's given regardless of which category
// found the page; the labels below are only to help it understand context.
const CATEGORY_KEYWORDS: Record<PageCategory, RegExp> = {
  about: /about|sobre|empresa|quem-somos|who-we-are|team|equipa|company/i,
  careers: /career|careers|carreira|carreiras|\bjobs?\b|vagas|join-us|work-with-us|hiring|trabalhe/i,
  benefits: /benefit|benefits|beneficios|benefícios|perks|why-join|why-work|vantagens/i,
  contact: /contact|contacto|contactos|get-in-touch|fale-connosco|morada/i,
};

type PageCandidate = { url: string; text: string };

/**
 * Pulls every same-origin `<a href>` on the homepage into a (url, visible
 * text) pair — the link text is real signal ("Careers", "Quem somos") that
 * a bare URL slug doesn't always carry as clearly.
 */
export function extractHomepageLinks(html: string, baseUrl: string): PageCandidate[] {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const candidates: PageCandidate[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = match[1];
    const text = stripHtml(match[2]).replace(/\s+/g, " ").trim();
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin !== origin) continue;
      if (resolved.pathname === "/" || resolved.pathname === "") continue;
      const url = resolved.toString();
      if (seen.has(url)) continue;
      seen.add(url);
      candidates.push({ url, text });
    } catch {
      continue;
    }
  }
  return candidates;
}

/**
 * Best-effort `sitemap.xml` fetch — finds same-origin page URLs a site
 * might never actually link from its own homepage nav (common with a
 * mega-menu or a footer-only link), using the last path segment as a
 * stand-in for link text. A sitemap *index* (one that lists other sitemap
 * files rather than pages) just yields `<loc>` entries that won't match any
 * of `CATEGORY_KEYWORDS` — a graceful no-op, not an error, so there's no
 * need to special-case or recurse into it for this feature's purposes.
 * Never throws; a missing or unreachable sitemap just means relying on the
 * homepage's own links instead.
 */
async function fetchSitemapCandidates(baseUrl: string): Promise<PageCandidate[]> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    // SSRF defense (security audit finding) — see safe-fetch.ts.
    const result = await safeFetch(`${origin}/sitemap.xml`, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JustITBot/1.0; +https://justit.pt)" },
    });
    clearTimeout(timeout);
    if (!result.ok || !result.response.ok) return [];

    const buf = await result.response.arrayBuffer();
    if (buf.byteLength > MAX_SITEMAP_BYTES) return [];
    const xml = new TextDecoder().decode(buf);

    const candidates: PageCandidate[] = [];
    const seen = new Set<string>();
    for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
      if (candidates.length >= 300) break;
      try {
        const resolved = new URL(match[1]);
        if (resolved.origin !== origin) continue;
        const url = resolved.toString();
        if (seen.has(url)) continue;
        seen.add(url);
        const lastSegment = resolved.pathname.split("/").filter(Boolean).pop() ?? "";
        candidates.push({ url, text: lastSegment.replace(/[-_]/g, " ") });
      } catch {
        continue;
      }
    }
    return candidates;
  } catch {
    return [];
  }
}

/**
 * Picks the best-matching candidate page per category from a combined pool
 * (homepage links first, since their link text is a stronger signal, then
 * sitemap-only extras) — first match wins per category, same as the
 * original single-category version. Returns a deduplicated list of the
 * unique URLs actually chosen, capped at `MAX_EXTRA_PAGES`, each labeled by
 * which category/categories picked it (a page can legitimately serve more
 * than one, e.g. a combined "About & Careers" page).
 */
export function pickCandidatePages(
  pool: PageCandidate[],
  homepageUrl: string,
): { url: string; labels: PageCategory[] }[] {
  const byUrl = new Map<string, PageCategory[]>();
  for (const category of Object.keys(CATEGORY_KEYWORDS) as PageCategory[]) {
    const pattern = CATEGORY_KEYWORDS[category];
    const found = pool.find((c) => c.url !== homepageUrl && (pattern.test(c.url) || pattern.test(c.text)));
    if (!found) continue;
    const labels = byUrl.get(found.url) ?? [];
    labels.push(category);
    byUrl.set(found.url, labels);
  }
  return [...byUrl.entries()].slice(0, MAX_EXTRA_PAGES).map(([url, labels]) => ({ url, labels }));
}

const CATEGORY_LABEL: Record<PageCategory, string> = {
  about: "About/Team",
  careers: "Careers",
  benefits: "Benefits",
  contact: "Contact",
};

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    // SSRF defense (security audit finding) — `url` here is a candidate
    // page discovered from the homepage's own links or sitemap.xml, not
    // just the original caller-supplied URL — see safe-fetch.ts.
    const result = await safeFetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JustITBot/1.0; +https://justit.pt)" },
    });
    clearTimeout(timeout);
    if (!result.ok || !result.response.ok) return null;

    const buf = await result.response.arrayBuffer();
    if (buf.byteLength > MAX_FETCH_BYTES) return null;
    const html = new TextDecoder().decode(buf);
    return stripHtml(html).slice(0, MAX_PAGE_PROMPT_CHARS);
  } catch {
    return null;
  }
}

/**
 * "Autofill from website" (console company-profile settings) — fetches a
 * company's own homepage server-side, then crawls a handful more same-site
 * pages in parallel (About/Team, Careers, Benefits, Contact — found via the
 * homepage's own links and, best-effort, `sitemap.xml`), extracts logo and
 * social links deterministically from the homepage's raw markup, and asks
 * the model to fill only the text fields it's genuinely confident about —
 * every field is nullable (or an empty array), and the prompt explicitly
 * forbids inventing anything. Returns a suggestion payload only; nothing is
 * written to the database here — the console form prefills from it and the
 * employer still reviews/edits/saves normally (same UX as job-URL
 * extraction).
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
    // SSRF defense (security audit finding) — see safe-fetch.ts.
    const result = await safeFetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JustITBot/1.0; +https://justit.pt)" },
    });
    clearTimeout(timeout);
    if (!result.ok) return { ok: false, reason: result.reason === "fetch_failed" ? "fetch_failed" : "invalid_url" };
    if (!result.response.ok) return { ok: false, reason: "fetch_failed" };

    const buf = await result.response.arrayBuffer();
    if (buf.byteLength > MAX_FETCH_BYTES) return { ok: false, reason: "too_large" };
    html = new TextDecoder().decode(buf);
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }

  const logoUrl = findLogoCandidate(html, parsed.toString());
  const socials = findSocialLinks(html);
  const homepageText = stripHtml(html).slice(0, MAX_PAGE_PROMPT_CHARS);
  if (homepageText.length < 100) return { ok: false, reason: "empty_content" };

  // Best-effort extra pages — a failure anywhere here just means proceeding
  // with fewer sources, never a hard failure for the whole request.
  const homepageUrl = parsed.toString();
  const [homepageLinks, sitemapLinks] = await Promise.all([
    Promise.resolve(extractHomepageLinks(html, homepageUrl)),
    fetchSitemapCandidates(homepageUrl),
  ]);
  const picked = pickCandidatePages([...homepageLinks, ...sitemapLinks], homepageUrl);
  const fetchedPages = await Promise.all(
    picked.map(async (p) => ({ labels: p.labels, text: await fetchPageText(p.url) })),
  );

  const extraSections = fetchedPages
    .filter((p): p is { labels: PageCategory[]; text: string } => !!p.text)
    .map((p) => `${p.labels.map((l) => CATEGORY_LABEL[l]).join(" / ")} page text:\n${p.text}`);

  const pageText = [`Homepage text:\n${homepageText}`, ...extraSections].join("\n\n");

  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: LlmFieldsSchema }),
      prompt:
        "Extract company profile fields from this company's own website text below — the " +
        "homepage, plus whichever of its About/Team, Careers, Benefits and Contact pages were " +
        "found. Only fill a field when it is genuinely stated or clearly implied — leave it " +
        "null (or an empty array) if you are not confident. Never invent an industry, company " +
        "size, benefit, address or team member that is not actually indicated by the text.\n\n" +
        "`tagline` should be a short (one sentence) description of what the company does, " +
        "suitable as a brief summary line. `aboutUs` should be a longer, faithfully-formatted " +
        "copy of the company's own \"about us\"-style narrative where one exists — not a " +
        "summary, keep the actual wording, just clean up obvious extraction noise (stray " +
        "whitespace, broken line wraps). Preserve paragraph breaks (join with \\n). `industry` " +
        "is a short phrase (e.g. \"Software development\", \"Fintech\", \"E-commerce\"), not a " +
        "long description. `companySize` should only be filled from an explicit statement of " +
        "headcount or a range (e.g. \"50+ employees\", \"a team of 20\", \"mais de 100 " +
        "colaboradores\", \"11-50 employees\") — not guessed from anything else on the page " +
        "(e.g. number of office locations, funding amount, or how many people appear in a team " +
        "photo).\n\n" +
        "`benefitsText` should faithfully preserve the real perks/benefits actually listed on a " +
        "Careers/Benefits/culture page (one per line, joined with \\n) — never a generic list " +
        "of perks you'd expect a company to offer; only what the text genuinely states. " +
        "`howWeWorkText` is a short narrative about working style, remote/hybrid policy or team " +
        "culture, only when the text explicitly describes it (not inferred from generic " +
        "marketing copy). `address` is only a real, explicit postal or office address (street " +
        "and city, or similarly precise) — a bare mention of a city name alone (\"we're based in " +
        "Lisbon\") is not enough to fill this. `teamMembers` lists every specific named person " +
        "with a stated role/title found on a real Team/Leadership page — never a customer " +
        "testimonial author, a blog post author, or a generic \"our team\" photo caption with no " +
        "name; an empty array if none are genuinely identifiable.\n\n" +
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
