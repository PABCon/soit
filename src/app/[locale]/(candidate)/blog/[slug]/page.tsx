import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { getBlogPost, getOtherBlogPosts, getAdjacentBlogPosts } from "@/lib/blog";
import { safeJsonLd } from "@/lib/json-ld";
import { ShareButtons } from "@/components/blog/ShareButtons";

type Props = { params: Promise<{ locale: string; slug: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getBlogPost(slug, locale);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: localeAlternates(`/blog/${slug}`, locale),
    ...socialMeta({
      title: post.title,
      description: post.excerpt,
      url: `${SITE}/${locale}/blog/${slug}`,
      image: `${SITE}${post.coverImage}`,
      imageIsLandscape: true,
    }),
  };
}

function articleJsonLd(post: { title: string; excerpt: string; date: string; coverImage: string }, locale: string, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    image: `${SITE}${post.coverImage}`,
    url: `${SITE}/${locale}/blog/${slug}`,
    publisher: { "@type": "Organization", name: "Just IT", url: SITE },
  };
}

function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "blog" });
  const post = await getBlogPost(slug, locale);
  if (!post) notFound();

  const related = getOtherBlogPosts(locale, slug, 3);
  const { previous, next } = getAdjacentBlogPosts(locale, slug);
  const url = `${SITE}/${locale}/blog/${slug}`;

  return (
    <div className="mx-auto max-w-6xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd(post, locale, slug)) }}
      />

      <Link href="/blog" className="text-sm font-medium text-muted hover:text-pine">
        {t("backToBlog")}
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_300px]">
        <article className="min-w-0">
          <span className="inline-flex items-center rounded-full bg-pine/10 px-2.5 py-1 text-xs font-medium text-pine">
            {t(`category.${post.category}`)}
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">{post.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted">
            <span>{formatDate(post.date, locale)}</span>
            <span aria-hidden="true">·</span>
            <span>{t("minRead", { count: post.readingTimeMinutes })}</span>
          </div>

          <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-paper">
            <Image src={post.coverImage} alt="" fill sizes="(min-width: 1024px) 700px, 100vw" className="object-cover" priority />
          </div>

          <div
            className="prose prose-sm sm:prose-base prose-headings:font-display prose-headings:font-bold prose-a:text-pine mt-8 max-w-none"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />

          {(previous || next) && (
            <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6 text-sm">
              {previous ? (
                <Link href={`/blog/${previous.slug}`} className="min-w-0">
                  <span className="block text-xs text-muted">← {t("previousArticle")}</span>
                  <span className="mt-0.5 block truncate font-medium text-ink hover:text-pine">{previous.title}</span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link href={`/blog/${next.slug}`} className="min-w-0 text-right">
                  <span className="block text-xs text-muted">{t("nextArticle")} →</span>
                  <span className="mt-0.5 block truncate font-medium text-ink hover:text-pine">{next.title}</span>
                </Link>
              )}
            </div>
          )}
        </article>

        <aside className="flex flex-col gap-6">
          {related.length > 0 && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-sm font-bold text-ink">{t("relatedArticlesHeading")}</h2>
              <ul className="mt-4 flex flex-col gap-4">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/blog/${r.slug}`} className="flex gap-3">
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-paper">
                        <Image src={r.coverImage} alt="" fill sizes="56px" className="object-cover" />
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 block text-sm font-medium text-ink hover:text-pine">{r.title}</span>
                        <span className="mt-1 block text-xs text-muted">{formatDate(r.date, locale)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-pine/5 p-5">
            <div className="relative mx-auto h-20 w-20">
              <Image src="/blog/robot-sidebar.png" alt="" fill sizes="80px" className="object-contain" />
            </div>
            <h2 className="mt-4 text-sm font-bold text-ink">{t("findOpportunityHeading")}</h2>
            <p className="mt-1 text-xs text-muted">{t("findOpportunityBody")}</p>
            <Link href="/jobs" className="mt-4 inline-block text-sm font-medium text-pine hover:underline">
              {t("browseJobsCta")}
            </Link>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-sm font-bold text-ink">{t("shareArticleHeading")}</h2>
            <div className="mt-3">
              <ShareButtons url={url} title={post.title} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
