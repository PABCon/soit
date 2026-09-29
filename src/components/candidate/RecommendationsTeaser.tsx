import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJobRecommendationsForCandidate } from "@/lib/db/recommendations";

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
      body = result.reason === "empty_profile" ? t("emptyProfilePitch") : t("anonPitch");
    } else if (result.jobs.length > 0) {
      body = t("matchesPitch", { count: result.jobs.length });
    } else {
      body = t("noMatchesPitch");
    }
  }

  return (
    <Link
      href="/recommendations"
      className="mb-6 flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-pine to-pine/80 px-5 py-4 text-white shadow-sm transition-transform hover:scale-[1.01]"
    >
      <span className="flex items-center gap-2 text-sm font-medium sm:text-base">
        <span aria-hidden>✨</span>
        {body}
      </span>
      <span className="shrink-0 text-sm font-semibold whitespace-nowrap">{t("cta")} →</span>
    </Link>
  );
}
