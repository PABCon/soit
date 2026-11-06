import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { BlogPostMeta } from "@/lib/blog";

function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BlogCard({ post, locale }: { post: BlogPostMeta; locale: string }) {
  const t = useTranslations("blog");

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-md">
      <Link href={`/blog/${post.slug}`} className="relative aspect-video w-full overflow-hidden bg-paper">
        <Image src={post.coverImage} alt="" fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <span className="inline-flex w-fit items-center rounded-full bg-pine/10 px-2.5 py-1 text-xs font-medium text-pine">
          {t(`category.${post.category}`)}
        </span>
        <Link href={`/blog/${post.slug}`} className="mt-3 font-display text-base font-bold text-ink hover:text-pine">
          {post.title}
        </Link>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{post.excerpt}</p>
        <div className="mt-4 flex items-center gap-3 text-xs text-muted">
          <span>{formatDate(post.date, locale)}</span>
          <span aria-hidden="true">·</span>
          <span>{t("minRead", { count: post.readingTimeMinutes })}</span>
        </div>
      </div>
    </article>
  );
}
