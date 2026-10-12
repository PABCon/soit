"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bookmark } from "lucide-react";
import { toggleFavoriteAction } from "@/app/[locale]/(candidate)/favorites/actions";

/** Optimistic save/unsave control (§7.1, real-usage QA round 3 phase 3).
 *  Default `variant="icon"` (a bare heart) is rendered as a sibling of
 *  JobRow's own Link, not nested inside it — an interactive control inside
 *  an anchor is invalid HTML — so it needs its own click handling to avoid
 *  also triggering the row's navigation.
 *
 *  Round 16: job-detail page needed the reference's full-width, labeled
 *  "Save for later" sidebar button — rather than build a second favorite
 *  toggle, this is the exact same component/state/action with a second
 *  `variant="labeled"` rendering, reusing `feed.favorite`/`feed.unfavorite`
 *  (already "Save job"/"Remove from saved") instead of new copy. */
export function FavoriteButton({
  jobId,
  initiallyFavorited,
  className = "",
  variant = "icon",
}: {
  jobId: string;
  initiallyFavorited: boolean;
  className?: string;
  variant?: "icon" | "labeled";
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

  const label = favorited ? t("unfavorite") : t("favorite");

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={favorited}
        className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-pine text-sm font-medium text-pine transition-colors hover:bg-subtle disabled:opacity-50 ${className}`}
      >
        <Bookmark className="h-4 w-4" fill={favorited ? "currentColor" : "none"} aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={favorited}
      title={label}
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
      <span className="sr-only">{label}</span>
    </button>
  );
}
