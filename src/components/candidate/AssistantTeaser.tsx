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
    // Full width again, per direct follow-up: a max-width cap (tried
    // first, in response to a "huge space in the middle" report) read as
    // the card itself being broken/too narrow on this page's much wider
    // (2200px) content column. `justify-between` instead: the text
    // column keeps its own natural width (no `flex-1` stretching it) and
    // the illustration sits flush at the opposite edge, so whatever space
    // is left between them reads as even, deliberate spacing rather than
    // either side looking stranded.
    <div className="mb-6 flex items-center justify-between gap-6 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-subtle to-white p-5 sm:p-6">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1 rounded-full bg-pine/15 px-2.5 py-1 text-xs font-semibold text-pine">
          <Sparkles aria-hidden className="h-3 w-3" />
          {t("badge")}
        </span>
        <h2 className="mt-2 text-lg font-bold text-ink sm:text-xl">{t("heading")}</h2>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-4 flex max-w-xl gap-2">
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
