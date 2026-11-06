"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CATEGORIES } from "@/lib/blog-categories";
import type { BlogPostMeta } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";

/**
 * Category tabs + search, both purely client-side — with a handful of
 * posts at this stage there's no reason to round-trip to the server for
 * either. Mirrors the same "small dataset, filter in memory" pattern
 * already used for jobs/companies elsewhere in this app.
 */
export function BlogListing({ posts, locale }: { posts: BlogPostMeta[]; locale: string }) {
  const t = useTranslations("blog");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (category !== "all" && post.category !== category) return false;
      if (q && !post.title.toLowerCase().includes(q) && !post.excerpt.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, category, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-3">
        <div className="flex flex-wrap gap-5 text-sm font-medium">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`border-b-2 pb-3 -mb-[13px] ${category === "all" ? "border-pine text-pine" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t("categoryAll")}
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`border-b-2 pb-3 -mb-[13px] ${category === cat ? "border-pine text-pine" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t(`category.${cat}`)}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full max-w-xs rounded-lg border border-line bg-white px-3 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <BlogCard key={post.slug} post={post} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
