"use client";

import { useTranslations } from "next-intl";
import { Crown, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/Badge";
import { buttonClassName } from "@/components/Button";

const SECTIONS = [
  { titleKey: "richProfileAboutUs", descKey: "richProfileAboutUsLockedDescription" },
  { titleKey: "richProfileHowWeWork", descKey: "richProfileHowWeWorkLockedDescription" },
  { titleKey: "richProfileBenefits", descKey: "richProfileBenefitsLockedDescription" },
  { titleKey: "richProfileCustomSectionBody", descKey: "richProfileCustomSectionLockedDescription" },
  { titleKey: "richProfileTeam", descKey: "richProfileTeamLockedDescription" },
  { titleKey: "richProfileTestimonials", descKey: "richProfileTestimonialsLockedDescription" },
  { titleKey: "richProfilePhotoGallery", descKey: "richProfilePhotoGalleryLockedDescription" },
  { titleKey: "richProfileVideoGallery", descKey: "richProfileVideoGalleryLockedDescription" },
] as const;

/** Console-only sales presentation for the rich-profile sections (billing
 *  phase 3) when the company isn't a Top Employer subscriber. Replaces the
 *  earlier blur+overlay treatment (`TopEmployerBlurGate`) with the
 *  reference design's cleaner pattern: a summary card (8 small locked
 *  chips + CTAs) followed by the same 8 sections as individual
 *  description rows. Still deliberately console-only — the public
 *  profile page's own gating is a plain field omission; candidates never
 *  see any "locked" UI. */
export function TopEmployerLockedProfile() {
  const t = useTranslations("console");
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/30">
            <Crown className="h-5 w-5 text-amber-700" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-ink">{t("richProfileLockedHeading")}</h3>
              <Badge variant="topEmployer">{t("topEmployerBadge")}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{t("richProfileLockedSubtitle")}</p>
          </div>
        </div>

        <p className="mt-4 text-xs font-medium text-muted">{t("richProfileLockedIncluded")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <span
              key={s.titleKey}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink"
            >
              <Lock className="h-3 w-3 text-muted" aria-hidden="true" />
              {t(s.titleKey)}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link href="/recruit/jobs/ads" className={buttonClassName({ size: "md" })}>
            {t("richProfileLockedExplore")}
          </Link>
          <Link href="/recruit/jobs/ads" className="text-sm font-medium text-pine hover:underline">
            {t("richProfileLockedViewPricing")}
          </Link>
        </div>
      </div>

      <div className="divide-y divide-line rounded-xl border border-line bg-white">
        {SECTIONS.map((s) => (
          <div key={s.titleKey} className="flex items-center gap-4 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper">
              <Lock className="h-4 w-4 text-muted" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{t(s.titleKey)}</p>
              <p className="text-sm text-muted">{t(s.descKey)}</p>
            </div>
            <Badge variant="topEmployer" className="shrink-0">
              {t("topEmployerBadge")}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
