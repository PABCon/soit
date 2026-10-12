import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getJobMatchScoreForCandidate } from "@/lib/db/recommendations";

/** Round-19 — reworked from round-15's "real match or nothing" banner
 *  into an always-show promo, same "ads mentality" reasoning
 *  `RecommendationsTeaser` already applies on `/jobs`: a slot that
 *  sometimes vanishes undermines the point of it being an always-there
 *  placement. Every branch reuses `recommendationsTeaser`'s own copy/
 *  destination — this component only differs in the one genuinely new
 *  case (`below_threshold`, a real score that just doesn't clear the bar
 *  for *this specific* job), which still reuses `noMatchesPitch` rather
 *  than inventing a new key, since the sentiment ("no strong matches
 *  right now, go see your matches page") already lines up. Only the real
 *  match branch (`ok: true`) keeps its own `job.aiMatchTitle`/
 *  `aiMatchSubtitle` copy, reusing the real scoring engine's actual
 *  score the same way `getJobMatchScoreForCandidate` always has. */
export async function JobMatchBanner({ jobId, locale }: { jobId: string; locale: string }) {
  const result = await getJobMatchScoreForCandidate(jobId);
  const t = await getTranslations({ locale, namespace: "job" });
  const tr = await getTranslations({ locale, namespace: "recommendationsTeaser" });

  let title: string;
  let subtitle: string;
  if (result.ok) {
    title = t("aiMatchTitle");
    subtitle = t("aiMatchSubtitle");
  } else {
    subtitle = tr("subtitle");
    switch (result.reason) {
      case "empty_profile":
        title = tr("emptyProfilePitch");
        break;
      case "no_preferences":
        title = tr("noPreferencesPitch");
        break;
      case "below_threshold":
        title = tr("noMatchesPitch");
        break;
      default:
        title = tr("anonPitch");
    }
  }

  return (
    <Link
      href="/recommendations"
      className="flex items-center justify-between gap-4 rounded-lg bg-gradient-to-r from-pine/20 to-pine/5 px-4 py-3 transition-colors hover:from-pine/25 hover:to-pine/10"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine/15">
          <Sparkles aria-hidden="true" className="h-5 w-5 text-pine" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-pine">{title}</span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>
      </span>
      <span className="shrink-0 rounded-md bg-pine px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white">
        {tr("cta")} →
      </span>
    </Link>
  );
}
