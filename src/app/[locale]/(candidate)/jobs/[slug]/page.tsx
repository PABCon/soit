import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { JobDetailBody } from "@/components/JobDetailBody";
import { getLiveJobBySlug, getSimilarJobs, type JobDetail } from "@/lib/db/jobs";
import { getApplyStatus } from "@/lib/db/applications";
import { getMyFavoriteJobIds } from "@/lib/db/favorites";
import { getCompanyBySlug } from "@/lib/db/companies";
import { localeAlternates, socialMeta } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const job = await getLiveJobBySlug(slug);
  if (!job) return {};

  const title = `${job.title} — ${job.company.name}`;
  // A per-job description was entirely missing before this (SEO audit
  // finding) — the single highest-value page in the app for social-share
  // CTR had no description and fell back to the generic site-level
  // tagline. Truncated: job descriptions can run long, and OG/Twitter
  // consumers (and search snippets) clip anyway — better to clip on a
  // word boundary ourselves than mid-word.
  const description = job.description.length > 200 ? `${job.description.slice(0, 197).trimEnd()}…` : job.description;

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

export default async function JobDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const job = await getLiveJobBySlug(slug);
  if (!job) notFound();

  const [applyStatus, favoriteJobIds, similarJobs, companyProfile] = await Promise.all([
    getApplyStatus(job.id),
    getMyFavoriteJobIds(),
    getSimilarJobs(job),
    getCompanyBySlug(job.company.slug),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobPostingJsonLd(job, locale)),
        }}
      />

      <JobDetailBody
        job={job}
        locale={locale}
        applyStatus={applyStatus}
        favoriteJobIds={favoriteJobIds}
        similarJobs={similarJobs}
        companyProfile={companyProfile}
      />
    </>
  );
}
