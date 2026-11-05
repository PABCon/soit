import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

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
 */
const BLOG_DIR = path.join(process.cwd(), "src/content/blog");

export type BlogPostMeta = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
};

export type BlogPost = BlogPostMeta & { html: string };

function postFilePath(slug: string, locale: string): string {
  return path.join(BLOG_DIR, slug, `${locale}.md`);
}

export function getAllBlogSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR).filter((entry) => fs.statSync(path.join(BLOG_DIR, entry)).isDirectory());
}

export function getBlogPostMeta(slug: string, locale: string): BlogPostMeta | null {
  const filePath = postFilePath(slug, locale);
  if (!fs.existsSync(filePath)) return null;
  const { data } = matter(fs.readFileSync(filePath, "utf8"));
  return { slug, title: data.title, excerpt: data.excerpt, date: data.date };
}

export function getAllBlogPostsMeta(locale: string): BlogPostMeta[] {
  return getAllBlogSlugs()
    .map((slug) => getBlogPostMeta(slug, locale))
    .filter((p): p is BlogPostMeta => p !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
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
  return { slug, title: data.title, excerpt: data.excerpt, date: data.date, html: processed.toString() };
}
