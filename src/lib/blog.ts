import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import type { BlogCategory } from "@/lib/blog-categories";

/**
 * The blog's own content store (growth plan: "get people to the platform
 * and start being in people's mind" via real, researched articles — not
 * a thin SEO-filler mill). Deliberately git-based, not a CMS: one
 * markdown file per post per locale, frontmatter for metadata, no
 * database table, no admin UI. A new post is a new file + a commit,
 * reviewable in a PR like every other change in this codebase — the
 * right amount of infrastructure for "occasional, carefully-researched
 * posts," not a high-volume content mill that would actually need a real
 * CMS. `src/content/blog/<slug>/<locale>.md` — a folder per post keeps
 * its PT/EN pair (which may genuinely diverge, not just be translations
 * of each other) next to one another.
 *
 * `category` is one of a small, fixed set (CATEGORIES below) matching the
 * design's own filter tabs — not a free-text taxonomy, since there's no
 * admin UI to keep a growing free-text list tidy. `coverImage` is a plain
 * path under /public/blog — no image-upload pipeline, covers are supplied
 * directly as files, same as the rest of this content system.
 */
const BLOG_DIR = path.join(process.cwd(), "src/content/blog");

export type BlogPostMeta = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: BlogCategory;
  coverImage: string;
  readingTimeMinutes: number;
};

export type BlogPost = BlogPostMeta & { html: string };

function postFilePath(slug: string, locale: string): string {
  return path.join(BLOG_DIR, slug, `${locale}.md`);
}

/** ~200 wpm, rounded up to the nearest minute, minimum 1 — same rough
 *  convention most blogs use, computed from the actual body text rather
 *  than hand-typed per post (which would drift the moment anyone edits a
 *  post without remembering to update it). */
function estimateReadingTimeMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function getAllBlogSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR).filter((entry) => fs.statSync(path.join(BLOG_DIR, entry)).isDirectory());
}

export function getBlogPostMeta(slug: string, locale: string): BlogPostMeta | null {
  const filePath = postFilePath(slug, locale);
  if (!fs.existsSync(filePath)) return null;
  const { data, content } = matter(fs.readFileSync(filePath, "utf8"));
  return {
    slug,
    title: data.title,
    excerpt: data.excerpt,
    date: data.date,
    category: data.category,
    coverImage: data.coverImage,
    readingTimeMinutes: estimateReadingTimeMinutes(content),
  };
}

export function getAllBlogPostsMeta(locale: string): BlogPostMeta[] {
  return getAllBlogSlugs()
    .map((slug) => getBlogPostMeta(slug, locale))
    .filter((p): p is BlogPostMeta => p !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Up to `limit` other posts, most recent first, excluding the current
 *  one — used for the detail page's "related articles" sidebar. No real
 *  relatedness logic (same category, tags, …) yet — with only a handful
 *  of posts at this stage, "everything else" and "genuinely related" are
 *  the same list; revisit once there's enough volume for that to matter. */
export function getOtherBlogPosts(locale: string, excludeSlug: string, limit: number): BlogPostMeta[] {
  return getAllBlogPostsMeta(locale)
    .filter((p) => p.slug !== excludeSlug)
    .slice(0, limit);
}

/** The chronologically previous/next post relative to `slug`, in the same
 *  locale — null when there isn't one (first/last post, or only one post
 *  exists). "Previous" = older (next item in date-descending order);
 *  "next" = newer. */
export function getAdjacentBlogPosts(
  locale: string,
  slug: string,
): { previous: BlogPostMeta | null; next: BlogPostMeta | null } {
  const all = getAllBlogPostsMeta(locale);
  const index = all.findIndex((p) => p.slug === slug);
  if (index === -1) return { previous: null, next: null };
  return { previous: all[index + 1] ?? null, next: index > 0 ? all[index - 1] : null };
}

/** Markdown -> HTML at request time (not build time — post volume is low
 *  enough this is cheap, and it keeps the content loader simple, no
 *  separate build step to keep in sync). GFM for real tables (used by
 *  the pilot post's comparison table). `remark-html` escapes by default
 *  — safe even though this specific content is always our own, trusted,
 *  git-reviewed markdown, never anything user-submitted. */
export async function getBlogPost(slug: string, locale: string): Promise<BlogPost | null> {
  const filePath = postFilePath(slug, locale);
  if (!fs.existsSync(filePath)) return null;
  const { data, content } = matter(fs.readFileSync(filePath, "utf8"));
  const processed = await remark().use(remarkGfm).use(remarkHtml).process(content);
  return {
    slug,
    title: data.title,
    excerpt: data.excerpt,
    date: data.date,
    category: data.category,
    coverImage: data.coverImage,
    readingTimeMinutes: estimateReadingTimeMinutes(content),
    html: processed.toString(),
  };
}
