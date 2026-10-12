import { getTranslations } from "next-intl/server";
import { Sparkles, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJobRecommendationsForCandidate } from "@/lib/db/recommendations";
import { TechIcon } from "@/components/icons/tech-icons";
import { CategoryIcon } from "@/components/icons/category-icons";

/**
 * §AI Pieces backlog, item 4 — the "ads mentality" homepage placement you
 * asked for: the first thing a visitor sees on `/jobs`, always rendering
 * *something* rather than sometimes vanishing (an ad slot that
 * disappears unpredictably undermines the whole point). Three branches,
 * all linking to `/recommendations`, which itself owns the real
 * anonymous-vs-candidate logic — this component only picks which one-
 * line pitch to show.
 */
export async function RecommendationsTeaser() {
  const t = await getTranslations("recommendationsTeaser");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: string;
  if (!user) {
    body = t("anonPitch");
  } else {
    const result = await getJobRecommendationsForCandidate();
    if (!result.ok) {
      if (result.reason === "empty_profile") body = t("emptyProfilePitch");
      else if (result.reason === "no_preferences") body = t("noPreferencesPitch");
      else body = t("anonPitch");
    } else if (result.jobs.length > 0) {
      body = t("matchesPitch", { count: result.jobs.length });
    } else {
      body = t("noMatchesPitch");
    }
  }

  return (
    // Round-10 full-fidelity sweep: pixel-sampled the reference's own
    // "Banner" swatch directly and found this component had the whole
    // color scheme backwards — a solid-pine banner with a white-on-pine
    // CTA pill, when the reference is the other way around: a *pale*
    // blue-tinted banner (sampled ~bg-pine/20 fading toward transparent)
    // with dark-pine bold text, and the CTA is the one genuinely solid-
    // pine, white-text element. An earlier round's "solid primary blue"
    // description was a misread of the same image, corrected here.
    // The avatar and the three skill chips stay deliberately generic
    // decoration (no fabricated photo), per that same earlier round's
    // reasoning — only their colors change to read correctly on a light
    // background instead of a dark one.
    <Link
      href="/recommendations"
      className="relative mb-6 flex items-center justify-between gap-4 overflow-hidden rounded-lg bg-gradient-to-r from-pine/20 to-pine/5 px-4 py-3 transition-colors hover:from-pine/25 hover:to-pine/10"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine/15">
          <Sparkles aria-hidden className="h-5 w-5 text-pine" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-pine">{body}</span>
          <span className="block truncate text-xs text-muted">{t("subtitle")}</span>
        </span>
      </span>

      {/* Decorative illustration — generic avatar + three example skill
       *  chips, hidden below `md` where there's no room for it without
       *  crowding the real text/button. */}
      <span className="relative hidden h-11 shrink-0 items-center md:flex" style={{ width: 150 }}>
        <Sparkles aria-hidden className="absolute -top-1 left-6 h-3 w-3 text-pine/60" />
        <span className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full bg-pine/15 ring-2 ring-pine/20">
          <User aria-hidden className="h-5 w-5 text-pine" />
        </span>
        <span className="absolute top-0 left-10 flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 shadow-sm">
          <TechIcon slug="python" className="h-3 w-3" />
          <span className="text-[9px] font-medium text-ink">Python</span>
        </span>
        <span className="absolute top-5 left-14 flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 shadow-sm">
          <TechIcon slug="react" className="h-3 w-3" />
          <span className="text-[9px] font-medium text-ink">React</span>
        </span>
        <span className="absolute top-9 left-7 flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 shadow-sm">
          <CategoryIcon slug="devops-cloud" className="h-3 w-3 text-ink" />
          <span className="text-[9px] font-medium text-ink">DevOps</span>
        </span>
      </span>

      <span className="z-10 shrink-0 rounded-md bg-pine px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white">
        {t("cta")} →
      </span>
    </Link>
  );
}
