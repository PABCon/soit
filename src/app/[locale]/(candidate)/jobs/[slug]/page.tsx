import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { permanentRedirect } from "@/i18n/navigation";
import { JobDetailBody } from "@/components/JobDetailBody";
import { getJobBySlugEverPublished, getBrowseJobs, getSimilarJobs, type JobDetail } from "@/lib/db/jobs";
import { getApplyStatus } from "@/lib/db/applications";
import { getMyFavoriteJobIds } from "@/lib/db/favorites";
import { getCompanyBySlug } from "@/lib/db/companies";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { safeJsonLd } from "@/lib/json-ld";

type Props = { params: Promise<{ locale: string; slug: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// SEO policy, confirmed with the product owner: a closed job keeps its own
// "no longer accepting applications" page for a while (real visitors can
// still land on it from a recent share/bookmark/search ranking), but past
// this many days closed it 301s to a still-live page instead of sitting
// around indefinitely as stale crawl surface. `expiresAt` is used as the
// "closed since" reference point even for an employer-paused (not
// naturally expired) job — imprecise for that case (pausing doesn't move
// expiresAt), but only ever biases toward redirecting *later* than ideal,
// never earlier, which is the safe direction to be wrong in.
const STALE_CLOSED_JOB_DAYS = 90;

/** Where a stale-closed job's URL should 301 to: its own category+location
 *  browse page when that combination still has at least one live job
 *  (checked for real, not just linked blindly — an empty browse page is a
 *  worse landing than the plain job index), falling back one step at a
 *  time to the broader category-only browse page, then to `/jobs`. */
// Pulled out of the page component itself: `react-hooks/purity` flags a
// direct `Date.now()` call inside a component's own body (same reasoning
// already applied to JobExpiryBar's `expiryPercentLeft()` helper) — a
// plain, non-component function isn't subject to that rule.
function daysSince(isoDate: string): number {
  return (Date.now() - new Date(isoDate).getTime()) / 86_400_000;
}

async function resolveStaleRedirectTarget(job: JobDetail): Promise<string> {
  if (job.locationSlug && job.categorySlug) {
    const combo = await getBrowseJobs({ locationSlug: job.locationSlug, facetSlug: job.categorySlug });
    if (combo && combo.jobs.length > 0) return `/jobs/in/${job.locationSlug}/${job.categorySlug}`;
  }
  if (job.categorySlug) {
    const categoryOnly = await getBrowseJobs({ facetSlug: job.categorySlug });
    if (categoryOnly && categoryOnly.jobs.length > 0) return `/jobs/in/all-locations/${job.categorySlug}`;
  }
  return "/jobs";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const result = await getJobBySlugEverPublished(slug);
  if (!result) return {};
  const { job, live } = result;
  const t = await getTranslations({ locale, namespace: "job" });

  const title = `${job.title} — ${job.company.name}`;
  // A per-job description was entirely missing before this (SEO audit
  // finding) — the single highest-value page in the app for social-share
  // CTR had no description and fell back to the generic site-level
  // tagline. Truncated: job descriptions can run long, and OG/Twitter
  // consumers (and search snippets) clip anyway — better to clip on a
  // word boundary ourselves than mid-word.
  const rawDescription = job.description.length > 200 ? `${job.description.slice(0, 197).trimEnd()}…` : job.description;
  // SEO fix: an expired/closed job keeps its own real page (see
  // getJobBySlugEverPublished's own comment) rather than 404ing — the
  // snippet has to say so honestly, not keep advertising a dead posting.
  const description = live ? rawDescription : `${t("closedMetaPrefix")} ${rawDescription}`;

  return {
    title,
    description,
    alternates: localeAlternates(`/jobs/${slug}`, locale),
    ...socialMeta({
      title,
      description,
      url: `${SITE}/${locale}/jobs/${slug}`,
      image: job.company.logoUrl,
    }),
  };
}

/** §4.2 — unitText and employmentType map from the stored columns. */
const UNIT = { hour: "HOUR", day: "DAY", month: "MONTH", year: "YEAR" } as const;
const EMPLOYMENT = {
  permanent: "FULL_TIME",
  fixed_term: "FULL_TIME",
  contractor: "CONTRACTOR",
  freelance: "CONTRACTOR",
  internship: "INTERN",
} as const;

/** ISO 3166-1 alpha-2, keyed by `locations.country`'s real country name
 *  (§ job-location expansion) — JobPosting's `addressCountry` wants the
 *  code, not the name. A hardcoded "PT" here used to be correct for every
 *  job by construction (only Portuguese cities existed); now that a job's
 *  location can be any of the curated European hubs, the real country has
 *  to drive this. "PT" stays the fallback for a remote job (no
 *  `location_id` at all) or a legacy row that predates the locations
 *  taxonomy — both genuinely unknown-or-Portugal cases, not a guess. */
const COUNTRY_ISO: Record<string, string> = {
  Portugal: "PT",
  "United Kingdom": "GB",
  Germany: "DE",
  Netherlands: "NL",
  Ireland: "IE",
  France: "FR",
  Spain: "ES",
  Poland: "PL",
  "Czech Republic": "CZ",
  Austria: "AT",
  Switzerland: "CH",
  Sweden: "SE",
  Belgium: "BE",
};

function jobPostingJsonLd(job: JobDetail, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    // Google's Rich Results guidance for JobPosting recommends this for
    // applicant-tracking/dedup — SEO audit finding, was missing entirely.
    identifier: {
      "@type": "PropertyValue",
      name: job.company.name,
      value: job.id,
    },
    datePosted: job.publishedAt.slice(0, 10),
    validThrough: job.expiresAt.slice(0, 10),
    // schema.org's employmentType accepts an array — real-usage QA item
    // "multiple contract types on one job ad" means this can genuinely map
    // to more than one enum value now. Deduped (permanent and fixed_term
    // both map to FULL_TIME) and kept as a single string, not a 1-element
    // array, when there's only one — the common case, and the exact shape
    // every existing consumer of this JSON-LD already expects.
    employmentType: (() => {
      const mapped = [...new Set(job.employmentTypes.map((et) => EMPLOYMENT[et]))];
      return mapped.length === 1 ? mapped[0] : mapped;
    })(),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      sameAs: `${SITE}/${locale}/companies/${job.company.slug}`,
      // Google's Rich Results guidance recommends this for the logo to
      // actually appear in search results — was missing entirely (SEO
      // audit finding), even though it's a free read off the job's own
      // already-joined `companies` row.
      ...(job.company.logoUrl ? { logo: job.company.logoUrl } : {}),
    },
    ...(job.workModel === "remote"
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: {
            "@type": "Country",
            name: "Portugal",
          },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location,
              addressCountry: COUNTRY_ISO[job.locationCountry ?? "Portugal"] ?? "PT",
            },
          },
        }),
    // Omitted entirely when the employer has hidden the salary publicly
    // (§pricing) — job.salaryMin/Max are already null on that path
    // (hideSalaryIfPrivate, applied in getLiveJobBySlug), so there's
    // nothing real to put in structured data here either.
    ...(job.salaryMin != null && job.salaryMax != null
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "EUR",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salaryMin,
              maxValue: job.salaryMax,
              unitText: UNIT[job.salaryPeriod],
            },
          },
        }
      : {}),
  };
}

/** SEO audit finding: the page already renders a real, visible breadcrumb
 *  nav (Jobs / company / title, in JobDetailBody) with no matching
 *  structured data — free `BreadcrumbList` rich-result eligibility.
 *  Rendered regardless of `live` — it's navigation structure, not a
 *  "this job is live" claim the way JobPosting is. */
function breadcrumbJsonLd(job: JobDetail, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Jobs", item: `${SITE}/${locale}/jobs` },
      {
        "@type": "ListItem",
        position: 2,
        name: job.company.name,
        item: `${SITE}/${locale}/companies/${job.company.slug}`,
      },
      { "@type": "ListItem", position: 3, name: job.title },
    ],
  };
}

export default async function JobDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const result = await getJobBySlugEverPublished(slug);
  if (!result) notFound();
  const { job, live } = result;

  if (!live && daysSince(job.expiresAt) > STALE_CLOSED_JOB_DAYS) {
    permanentRedirect({ href: await resolveStaleRedirectTarget(job), locale });
  }

  const [applyStatus, favoriteJobIds, similarJobs, companyProfile] = await Promise.all([
    getApplyStatus(job.id),
    getMyFavoriteJobIds(),
    getSimilarJobs(job),
    getCompanyBySlug(job.company.slug),
  ]);

  return (
    <>
      {/* SEO fix: JobPosting structured data must never describe a dead
       *  posting as live — Google's JobPosting guidance treats stale
       *  structured data on an expired job as a rich-results policy
       *  violation (risks losing rich-result eligibility sitewide), so
       *  this is omitted entirely once the job is no longer live, rather
       *  than kept with a backdated validThrough. */}
      {live && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(jobPostingJsonLd(job, locale)),
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(breadcrumbJsonLd(job, locale)),
        }}
      />

      <JobDetailBody
        job={job}
        locale={locale}
        applyStatus={applyStatus}
        favoriteJobIds={favoriteJobIds}
        similarJobs={similarJobs}
        companyProfile={companyProfile}
        closed={!live}
      />
    </>
  );
}
