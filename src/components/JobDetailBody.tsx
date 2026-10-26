import { getTranslations } from "next-intl/server";
import { MapPin, Home, Briefcase, TrendingUp, Clock, Building2, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Salary } from "@/components/Salary";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TechStackDetail } from "@/components/TechStackDetail";
import { ApplyModal } from "@/components/ApplyModal";
import { EngagementPopup } from "@/components/EngagementPopup";
import { JobViewTracker } from "@/components/JobViewTracker";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { JobMatchBanner } from "@/components/JobMatchBanner";
import { JobTabsSection } from "@/components/JobTabsSection";
import { JobExpiryBar, expiryPercentLeft } from "@/components/JobExpiryBar";
import { JobDescriptionBody } from "@/components/JobDescriptionBody";
import { CompactJobRow } from "@/components/CompactJobRow";
import { Badge } from "@/components/Badge";
import { buttonClassName } from "@/components/Button";
import type { JobDetail } from "@/lib/db/jobs";
import type { Job } from "@/lib/types";
import type { ApplyStatus } from "@/lib/db/applications";
import type { getCompanyBySlug } from "@/lib/db/companies";

type CompanyProfile = Awaited<ReturnType<typeof getCompanyBySlug>>;

/** The real job detail page's own content — extracted so the employer-side
 *  "preview" route (`/jobs/preview/[id]`) can render a job exactly
 *  the way candidates will actually see it, rather than a second,
 *  independently-maintained simplified mock (the earlier `JobForm`-embedded
 *  preview modal's own approach, replaced per direct feedback: "it should
 *  display as if it was like the real page"). The real page
 *  (`(candidate)/jobs/[slug]/page.tsx`) still owns `generateMetadata`/
 *  JSON-LD/`setRequestLocale` — none of that applies to an unpublished
 *  draft a candidate will never actually land on.
 *
 *  `preview` strips everything that assumes a real, live, already-indexed
 *  job with a genuine candidate audience: no view tracking, no engagement
 *  popup nudge, no match-score banner (there's no real candidate session
 *  behind an employer's own preview), and Apply/Favorite become a plain
 *  disabled placeholder instead of a live, working flow. */
export async function JobDetailBody({
  job,
  locale,
  applyStatus,
  favoriteJobIds,
  similarJobs,
  companyProfile,
  preview = false,
}: {
  job: JobDetail;
  locale: string;
  applyStatus: ApplyStatus | null;
  favoriteJobIds: string[] | null;
  similarJobs: Job[];
  companyProfile: CompanyProfile;
  preview?: boolean;
}) {
  const [t, tf, tjf] = await Promise.all([
    getTranslations({ locale, namespace: "job" }),
    getTranslations({ locale, namespace: "feed" }),
    getTranslations({ locale, namespace: "jobForm" }),
  ]);

  const expiryPercent = expiryPercentLeft(job.publishedAt, job.expiresAt);

  // Round-15: a real "view all similar" destination only exists when
  // getSimilarJobs matched by category (there's a real browse page for
  // that) — the same-company fallback has no equivalent "all this
  // company's jobs" page beyond the company profile itself, so no link
  // is shown in that case rather than pointing it nowhere.
  const similarViewAllHref = job.categorySlug ? `/jobs/in/all-locations/${job.categorySlug}` : null;

  const companyInfoCard = (
    <div className="flex items-start gap-3">
      <CompanyLogo company={job.company} size="md" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/companies/${job.company.slug}`}
          className="font-display font-semibold text-ink hover:text-pine hover:underline"
        >
          {job.company.name}
        </Link>
        {(companyProfile?.industry || companyProfile?.companySize) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            {companyProfile.industry && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                {companyProfile.industry}
              </span>
            )}
            {companyProfile.companySize && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {companyProfile.companySize}
              </span>
            )}
          </p>
        )}
        {job.companyBlurb && <p className="mt-2 text-sm text-ink">{job.companyBlurb}</p>}
        <Link href={`/companies/${job.company.slug}`} className="mt-3 inline-block text-sm text-pine hover:underline">
          {t("viewCompanyProfile")}
        </Link>
      </div>
    </div>
  );

  const tabs = [
    {
      key: "overview",
      label: t("tabOverview"),
      content: (
        <div className="space-y-6">
          {!preview && <JobMatchBanner jobId={job.id} locale={locale} />}
          <div>
            <h3 className="font-display text-lg font-semibold">{t("aboutRole")}</h3>
            <div className="mt-2">
              <JobDescriptionBody description={job.description} />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "requirements",
      label: t("requirements"),
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-sm font-semibold tracking-wide text-muted">{t("stack")}</h3>
            <div className="mt-2">
              <TechStackDetail techStack={job.techStack} />
            </div>
          </div>
          {job.requiredLanguages.length > 0 && (
            <div>
              <h3 className="font-display text-sm font-semibold tracking-wide text-muted">
                {tjf("requiredLanguages")}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.requiredLanguages.map((lang) => (
                  <span key={lang.slug} className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-muted">
                    {lang.label}
                    {lang.level ? ` — ${tjf(`levelOption.${lang.level}`)}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    // No separate "Company" tab: the sidebar already carries a full
    // company card (logo/industry/size/blurb/map/profile link, below) —
    // duplicating that same block as a tab content pane read fine on
    // desktop's two-column layout but stacked as two literally identical
    // cards back-to-back the moment the page collapses to one column on
    // mobile (confirmed via a real screenshot, not assumed). One real
    // source of this content, not two.
    // Benefits is deliberately only added as a tab when there's real
    // backing data — `benefitsText` is a Top-Employer-gated company
    // field (§pricing phase 3), so most companies genuinely have none;
    // no "Process" tab exists at all since there's no hiring-process
    // data anywhere in this product's model and the reference's own
    // version of that tab would have to be fabricated.
    ...(companyProfile?.benefitsText
      ? [
          {
            key: "benefits",
            label: t("tabBenefits"),
            content: <JobDescriptionBody description={companyProfile.benefitsText} />,
          },
        ]
      : []),
  ];

  return (
    <>
      {!preview && (
        <>
          <EngagementPopup jobSlug={job.slug} />
          <JobViewTracker jobId={job.id} />
        </>
      )}

      <nav className="flex items-center gap-1.5 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/jobs" className="hover:text-pine hover:underline">
          {t("breadcrumbJobs")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/companies/${job.company.slug}`} className="hover:text-pine hover:underline">
          {job.company.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="min-w-0 truncate text-ink">{job.title}</span>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <div className="rounded-xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <CompanyLogo company={job.company} size="lg" />
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-bold">{job.title}</h1>
                  <p className="mt-1 text-muted">
                    <Link href={`/companies/${job.company.slug}`} className="hover:text-pine hover:underline">
                      {job.company.name}
                    </Link>{" "}
                    · {job.location ?? tf("remote")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-3 text-right">
                {job.contractSalaries.length > 0 && (
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {tjf(`employmentTypeOption.${job.employmentType}`)}
                  </p>
                )}
                <Salary
                  min={job.salaryMin}
                  max={job.salaryMax}
                  period={job.salaryPeriod}
                  months={job.salaryMonths}
                  employmentType={job.employmentType}
                  basis={job.salaryBasis}
                  size="detail"
                />
                {/* Real-usage finding: some postings genuinely offer two
                 *  different contract types at two different rates (e.g. a
                 *  gross B2B day-rate alongside a net permanent salary) —
                 *  each extra accepted type that has its own distinct range
                 *  gets its own labeled block here, instead of a single
                 *  number silently standing in for both. */}
                {job.contractSalaries.map((cs) => (
                  <div key={cs.employmentType} className="border-t border-line pt-3">
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                      {tjf(`employmentTypeOption.${cs.employmentType}`)}
                    </p>
                    <Salary
                      min={cs.min}
                      max={cs.max}
                      period={cs.period}
                      months={cs.months}
                      employmentType={cs.employmentType}
                      basis={cs.basis}
                      size="detail"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {job.isTopEmployer && <Badge variant="topEmployer">{tf("topEmployer")}</Badge>}
              {job.isBoosted && <Badge variant="boosted">{tf("boosted")}</Badge>}
              {[
                tf(`workModel.${job.workModel}`),
                tf(`seniority.${job.seniority}`),
                job.language.toUpperCase(),
                ...job.employmentTypes.filter((et) => et !== job.employmentType).map((et) => tjf(`employmentTypeOption.${et}`)),
              ].map((b) => (
                <span key={b} className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-muted">
                  {b}
                </span>
              ))}
              {job.daysLeft !== null && job.daysLeft <= 7 && (
                <Badge variant="warning">{tf("daysLeft", { days: job.daysLeft })}</Badge>
              )}
              {!preview && (
                <span className="ml-auto flex shrink-0 gap-2">
                  {favoriteJobIds && (
                    <FavoriteButton
                      jobId={job.id}
                      initiallyFavorited={favoriteJobIds.includes(job.id)}
                      className="border border-line bg-white"
                    />
                  )}
                  <ShareButton />
                </span>
              )}
            </div>

            {/* Round 17: equal-width flex items (not the prior flex-wrap +
             *  content-width-only spans) so the five fields genuinely
             *  distribute across the full row — the prior version let
             *  `justify-start` (the flex default) clump everything to the
             *  left with a large empty gap on the right, which is the exact
             *  "not well distributed" complaint. `flex-nowrap` (no
             *  `flex-wrap`) plus `min-w-0`/`truncate` guarantees one row
             *  that degrades by truncating text, never by stacking. */}
            <div className="mt-4 flex flex-nowrap items-center border-t border-line pt-4 text-sm">
              <span className="flex h-9 min-w-0 flex-1 items-center gap-2 py-1 pr-4">
                <Briefcase className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted">{tjf("employmentType")}</span>
                  <span className="block truncate font-medium text-ink">{tjf(`employmentTypeOption.${job.employmentType}`)}</span>
                </span>
              </span>
              <span className="flex h-9 min-w-0 flex-1 items-center gap-2 border-l border-line py-1 px-4">
                <Home className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted">{tf("filterSectionWorkModel")}</span>
                  <span className="block truncate font-medium text-ink">{tf(`workModel.${job.workModel}`)}</span>
                </span>
              </span>
              <span className="flex h-9 min-w-0 flex-1 items-center gap-2 border-l border-line py-1 px-4">
                <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted">{tjf("location")}</span>
                  <span className="block truncate font-medium text-ink">{job.location ?? tf("remote")}</span>
                </span>
              </span>
              <span className="flex h-9 min-w-0 flex-1 items-center gap-2 border-l border-line py-1 px-4">
                <TrendingUp className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted">{tf("filterSectionSeniority")}</span>
                  <span className="block truncate font-medium text-ink">{tf(`seniority.${job.seniority}`)}</span>
                </span>
              </span>
              <span className="flex h-9 min-w-0 flex-1 items-center gap-2 border-l border-line py-1 pl-4">
                <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="truncate font-medium text-ink">
                  {preview ? t("previewBadge") : tf("postedAgo", { days: job.postedDaysAgo })}
                </span>
              </span>
            </div>
          </div>

          <div className="mt-8">
            <JobTabsSection tabs={tabs} />
          </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-line bg-white p-5">
            {preview || !applyStatus ? (
              <div>
                <button type="button" disabled className={`w-full ${buttonClassName({ size: "md" })} opacity-50`}>
                  {t("apply")}
                </button>
                <p className="mt-2 text-center text-xs text-muted">{t("previewApplyDisabled")}</p>
              </div>
            ) : (
              <ApplyModal
                jobSlug={job.slug}
                companyName={job.company.name}
                isCandidate={applyStatus.isCandidate}
                alreadyApplied={applyStatus.alreadyApplied}
                externalApplyUrl={job.externalApplyUrl}
                storedCv={applyStatus.storedCv}
              />
            )}
            {!preview && favoriteJobIds && (
              <div className="mt-3">
                <FavoriteButton jobId={job.id} initiallyFavorited={favoriteJobIds.includes(job.id)} variant="labeled" />
              </div>
            )}
            {!preview && expiryPercent !== null && (
              <div className="mt-3">
                <JobExpiryBar percentLeft={expiryPercent} />
                {job.daysLeft !== null && (
                  <p className="mt-1 text-center text-[11px] text-muted">{tf("daysLeft", { days: job.daysLeft })}</p>
                )}
              </div>
            )}
          </div>

          {(job.companyBlurb || (job.lat !== null && job.lng !== null) || companyProfile?.industry || companyProfile?.companySize) && (
            <div className="mt-4 rounded-xl border border-line bg-white p-5">{companyInfoCard}</div>
          )}

          {similarJobs.length > 0 && (
            <div className="mt-4 rounded-xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold">{t("similarRoles")}</h2>
                {similarViewAllHref && (
                  <Link href={similarViewAllHref} className="text-xs font-medium text-pine hover:underline">
                    {t("viewAll")}
                  </Link>
                )}
              </div>
              <div className="mt-1">
                {similarJobs.map((similar) => (
                  <CompactJobRow key={similar.id} job={similar} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
