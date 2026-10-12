import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Salary } from "@/components/Salary";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TechTags } from "@/components/TechTags";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Badge } from "@/components/Badge";
import type { Job } from "@/lib/types";

/**
 * One row of the feed — the hero of the product (§11).
 *
 * Corrective redesign (the generic/"admin dashboard" pass rejected a prior
 * version that just restyled this element): three genuinely distinct
 * information zones per the brief, not a single flex row with font-size
 * tweaks — (1) company/title, kept clean of any badge clutter so the title
 * reads with real emphasis; (2) a quieter secondary row for status badges
 * and tech tags, visually subordinate to the title; (3) salary, set off by
 * a vertical rule on desktop so it reads as its own column, not just
 * right-aligned text sharing the title's row. Status badges (Top Employer/
 * Boosted/New/days-left) are the only pill-shaped, *coloured* elements —
 * ad language and extra accepted contract types sit in the same row as
 * neutral outlined tags (identical styling to a tech tag), per the
 * design-system reference's own "Skill/Language/Status Tag" swatch
 * showing all three as one shared, uncoloured style.
 */
export function JobRow({
  job,
  isFavorited,
  matchScore,
}: {
  job: Job;
  isFavorited?: boolean;
  /** §AI Pieces backlog, item 4 — only ever passed by `/recommendations`;
   *  every other caller leaves this undefined and the badge never renders,
   *  so this stays a safe, additive change to a widely-reused component. */
  matchScore?: number;
}) {
  const t = useTranslations("feed");
  const tjf = useTranslations("jobForm");
  const isNew = job.postedDaysAgo <= 2;
  const daysLeft = job.daysLeft;
  // Real-usage QA item: "multiple contract types on one job ad" — the
  // primary type already shows next to the salary via <Salary>; any
  // *additional* accepted types get their own neutral Status Tag below.
  const extraEmploymentTypes = job.employmentTypes.filter((et) => et !== job.employmentType);

  return (
    // 10px radius, 1px border, ~12px padding (§3 geometry) — individual
    // cards, not hairline-divided table rows. Hover is a literal
    // background tint + stronger border per the brief's own wording.
    <li className="group @container relative rounded-[10px] border border-line bg-white transition-colors hover:border-muted/50 hover:bg-subtle/40">
      {/* A sibling of the Link, not nested inside it — an interactive
       *  button inside an anchor is invalid HTML, and isFavorited is only
       *  ever passed by pages that already know the viewer is a candidate. */}
      {isFavorited !== undefined && (
        <FavoriteButton
          jobId={job.id}
          initiallyFavorited={isFavorited}
          className="absolute top-3 right-3 z-10"
        />
      )}
      {/* Round-8 item 2: uniform card heights — content is now bounded
       *  (title truncates to one line, the badge row is capped to a
       *  fixed-height two-line box below) so every card's actual content
       *  height is ≤ this min-height, and @2xl:items-stretch already
       *  makes the salary column fill whatever height that produces. */}
      <Link
        href={`/jobs/${job.slug}`}
        className="flex flex-col gap-3 p-3 @2xl:min-h-[132px] @2xl:flex-row @2xl:items-stretch @2xl:gap-4"
      >
        {/* Zones 1+2: company/title, then the quieter status/tech row. */}
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <CompanyLogo company={job.company} size="sm" />
          <div className="min-w-0 flex-1">
            {/* Zone 1 — title gets to read alone, no badges crowding it.
             *  20px/28px/600 (H2 Job title) per the reference design
             *  system's own typography swatch — a real size change from
             *  the 15px both prior text specs described. */}
            <h2 className="truncate font-display text-xl leading-[28px] font-semibold tracking-tight text-ink group-hover:text-pine">
              {job.title}
            </h2>
            <p className="mt-0.5 truncate text-sm leading-5 text-muted">
              {job.company.name} · {job.location ?? t("remote")} · {t(`workModel.${job.workModel}`)} ·{" "}
              {t(`seniority.${job.seniority}`)}
            </p>

            {/* Zone 2 — real status badges (only ones that get colour) +
             *  tech tags, one subordinate row beneath the title. Caption
             *  typography (12px/16px/500) per the reference design system.
             *  Top Employer/Boosted are now solid, saturated fills — the
             *  reference image's own badge swatches render noticeably
             *  bolder than the pale tints both prior text specs described;
             *  this image supersedes those on exact colour. New stays the
             *  pale/outlined blue treatment the swatch still shows for it. */}
            <div className="mt-2 flex flex-wrap items-start gap-1.5 @2xl:h-[46px] @2xl:overflow-hidden">
                {matchScore !== undefined && (
                  <Badge variant="match">{t("matchScore", { percent: matchScore })}</Badge>
                )}
                {job.isTopEmployer && <Badge variant="topEmployer">{t("topEmployer")}</Badge>}
                {job.isBoosted && <Badge variant="boosted">{t("boosted")}</Badge>}
                {isNew && <Badge variant="new">{t("new")}</Badge>}
                {daysLeft !== null && daysLeft <= 7 && (
                  <Badge variant="warning">{t("daysLeft", { days: daysLeft })}</Badge>
                )}
                {/* Reference image's own "Skill Tag / Language Tag / Status
                 *  Tag" swatch shows all three as the identical neutral
                 *  outlined style (Python / EN / Permanent render alike) —
                 *  reusing TechTags' exact classes here rather than folding
                 *  these into the plain metadata line, which the image's
                 *  own mockup never does (its "EN" chip sits in this row,
                 *  not the text line below the title). */}
                <span className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-muted uppercase">
                  {job.language}
                </span>
                {extraEmploymentTypes.map((et) => (
                  <span key={et} className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-muted">
                    {tjf(`employmentTypeOption.${et}`)}
                  </span>
                ))}
                <TechTags tech={job.tech} max={4} />
            </div>
          </div>
        </div>

        {/* Zone 3 — salary, as its own column via the parent's @2xl:gap-4
         *  alone, no vertical rule (round-9: removed per direct feedback —
         *  it rendered inconsistently card to card once the round-8
         *  uniform-height fix changed each card's actual zone heights, and
         *  plain spacing reads fine without a replacement separator).
         *  @2xl:pr-10 reserves room for the absolutely-positioned favorite
         *  heart (top-3 right-3, h-8 w-8), only when this row actually has
         *  one. */}
        <div
          className={`flex shrink-0 flex-col justify-center border-t border-line pt-3 text-left @2xl:items-end @2xl:border-t-0 @2xl:pt-0 @2xl:text-right ${isFavorited !== undefined ? "@2xl:pr-10" : ""}`}
        >
          <Salary
            min={job.salaryMin}
            max={job.salaryMax}
            period={job.salaryPeriod}
            months={job.salaryMonths}
            employmentType={job.employmentType}
          />
          <p className="mt-1 text-[13px] leading-[18px] text-muted/70">{t("postedAgo", { days: job.postedDaysAgo })}</p>
        </div>
      </Link>
    </li>
  );
}
