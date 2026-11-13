"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

/**
 * The real goal behind this round's request: make the chat assistant
 * (branded "JT" in the UI) impossible to miss on the page every visitor
 * actually lands on (`/` redirects straight to `/jobs`, so this is
 * effectively the homepage). Mirrors the reference design's own left-
 * panel banner: a headline, an inline input that starts a real
 * conversation immediately (no extra click through a nav item first),
 * and the JT illustration. Submitting navigates to `/assistant?q=...`;
 * `AssistantChat` reads that param once on mount and sends it as the
 * conversation's first message, the same one-motion pattern
 * `MobileSearchBar`/`SearchBar` already use for "type and go" entry
 * points elsewhere in this app.
 */
export function AssistantTeaser() {
  const t = useTranslations("assistantTeaser");
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    router.push(trimmed ? `/assistant?q=${encodeURIComponent(trimmed)}` : "/assistant");
  }

  return (
    // `justify-between` (previous round) still read as two stranded
    // islands with one huge gap between them: it puts all the slack
    // space in the middle only, with the text and image still flush
    // against the card's own edges. Direct follow-up asked for the
    // literal `justify-content: around` model instead: visible margin
    // on both outer sides *and* a gap between the two, each getting a
    // fair share of the leftover space rather than it all pooling in
    // one spot.
    <div className="mb-6 flex items-center justify-around gap-6 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-subtle to-white p-5 sm:p-6">
      {/* A real, fixed width here (not a max-width on the form alone):
       *  with no `flex-grow`, a flex item with only a `max-w-*` cap still
       *  sizes to its own content's fit-content width, which left the
       *  input visibly narrower than its cap even after raising it. An
       *  explicit width makes the column's size deterministic, so the
       *  form (now `w-full` of this column rather than its own separate
       *  cap) genuinely fills it. */}
      <div className="w-full min-w-0 sm:w-[480px]">
        <span className="inline-flex items-center gap-1 rounded-full bg-pine/15 px-2.5 py-1 text-xs font-semibold text-pine">
          <Sparkles aria-hidden className="h-3 w-3" />
          {t("badge")}
        </span>
        <h2 className="mt-2 text-lg font-bold text-ink sm:text-xl">{t("heading")}</h2>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-4 flex w-full gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("inputPlaceholder")}
            className="h-12 min-w-0 flex-1 rounded-lg border border-line bg-white px-4 text-sm placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-pine"
          />
          <button
            type="submit"
            aria-label={t("submit")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-pine text-white transition-colors hover:bg-pine-hover"
          >
            <ArrowRight aria-hidden className="h-5 w-5" />
          </button>
        </form>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <Sparkles aria-hidden className="h-3 w-3 shrink-0 text-pine" />
          {t("helper")}
        </p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- same plain-img convention RecommendationsTeaser already uses for its own static illustration */}
      <img
        src="/jt-hero.png"
        alt=""
        className="hidden h-36 w-auto shrink-0 object-contain sm:block sm:h-44"
      />
    </div>
  );
}
