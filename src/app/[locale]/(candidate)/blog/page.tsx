import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { getAllBlogPostsMeta } from "@/lib/blog";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const title = t("listingTitle");
  const description = t("listingDescription");
  return {
    title,
    description,
    alternates: localeAlternates("/blog", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/blog` }),
  };
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "blog" });
  const posts = getAllBlogPostsMeta(locale);

  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("listingHeading")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t("listingIntro")}</p>

      {posts.length === 0 ? (
        <p className="mt-10 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-6">
          {posts.map((post) => (
            <li key={post.slug} className="rounded-2xl border border-line bg-paper p-6">
              <Link href={`/blog/${post.slug}`} className="font-display text-lg font-bold text-ink hover:text-pine">
                {post.title}
              </Link>
              <p className="mt-1 text-xs text-muted">
                {new Date(post.date).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{post.excerpt}</p>
              <Link href={`/blog/${post.slug}`} className="mt-3 inline-block text-sm font-medium text-pine hover:underline">
                {t("readMore")} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
