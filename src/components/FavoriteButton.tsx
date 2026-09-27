"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toggleFavoriteAction } from "@/app/[locale]/(candidate)/favorites/actions";

/** Optimistic save/unsave heart (§7.1, real-usage QA round 3 phase 3).
 *  Rendered as a sibling of JobRow's own Link, not nested inside it — an
 *  interactive control inside an anchor is invalid HTML — so it needs its
 *  own click handling to avoid also triggering the row's navigation. */
export function FavoriteButton({
  jobId,
  initiallyFavorited,
  className = "",
}: {
  jobId: string;
  initiallyFavorited: boolean;
  className?: string;
}) {
  const t = useTranslations("feed");
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      try {
        const result = await toggleFavoriteAction(jobId);
        setFavorited(result.favorited);
      } catch {
        setFavorited(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={favorited}
      title={favorited ? t("unfavorite") : t("favorite")}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-muted backdrop-blur-sm transition-colors hover:text-pine disabled:opacity-50 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 20-7-7a4 4 0 0 1 7-5 4 4 0 0 1 7 5Z" />
      </svg>
      <span className="sr-only">{favorited ? t("unfavorite") : t("favorite")}</span>
    </button>
  );
}
