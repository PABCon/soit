import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { getBlogPost } from "@/lib/blog";
import { safeJsonLd } from "@/lib/json-ld";

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
    ...socialMeta({ title: post.title, description: post.excerpt, url: `${SITE}/${locale}/blog/${slug}` }),
  };
}

function articleJsonLd(post: { title: string; excerpt: string; date: string }, locale: string, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    url: `${SITE}/${locale}/blog/${slug}`,
    publisher: { "@type": "Organization", name: "Just IT", url: SITE },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "blog" });
  const post = await getBlogPost(slug, locale);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd(post, locale, slug)) }} />

      <h1 className="font-display text-2xl font-bold sm:text-3xl">{post.title}</h1>
      <p className="mt-2 text-xs text-muted">
        {t("publishedOn")}{" "}
        {new Date(post.date).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      <div
        className="prose prose-sm sm:prose-base prose-headings:font-display prose-headings:font-bold prose-a:text-pine mt-6 max-w-none"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
    </article>
  );
}
