import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Salary } from "@/components/Salary";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TechTags } from "@/components/TechTags";
import { ApplyModal } from "@/components/ApplyModal";
import { EngagementPopup } from "@/components/EngagementPopup";
import { FavoriteButton } from "@/components/FavoriteButton";
import { JobExpiryBar, expiryPercentLeft } from "@/components/JobExpiryBar";
import { JobDescriptionBody } from "@/components/JobDescriptionBody";
import { getLiveJobBySlug, type JobDetail } from "@/lib/db/jobs";
import { getApplyStatus } from "@/lib/db/applications";
import { getMyFavoriteJobIds } from "@/lib/db/favorites";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string; slug: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const job = await getLiveJobBySlug(slug);
  if (!job) return {};

  return {
    title: `${job.title} — ${job.company.name}`,
    alternates: {
      canonical: `${SITE}/${locale}/jobs/${slug}`,
      // hreflang pairs, plus x-default pointing at the language redirect (§4.4).
      languages: {
        ...Object.fromEntries(
          routing.locales.map((l) => [l, `${SITE}/${l}/jobs/${slug}`]),
        ),
        "x-default": `${SITE}/`,
      },
    },
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

function jobPostingJsonLd(job: JobDetail, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.publishedAt.slice(0, 10),
    validThrough: job.expiresAt.slice(0, 10),
    employmentType: EMPLOYMENT[job.employmentType],
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      sameAs: `${SITE}/${locale}/companies/${job.company.slug}`,
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
              addressCountry: "PT",
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

  const t = await getTranslations({ locale, namespace: "job" });
  const tf = await getTranslations({ locale, namespace: "feed" });
  const tjf = await getTranslations({ locale, namespace: "jobForm" });
  const [applyStatus, favoriteJobIds] = await Promise.all([
    getApplyStatus(job.id),
    getMyFavoriteJobIds(),
  ]);

  const expiryPercent = expiryPercentLeft(job.publishedAt, job.expiresAt);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobPostingJsonLd(job, locale)),
        }}
      />

      <EngagementPopup jobSlug={slug} />

      <Link href="/jobs" className="text-sm text-muted hover:text-ink">
        ← {t("backToJobs")}
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <CompanyLogo company={job.company} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold">{job.title}</h1>
              <p className="mt-1 text-muted">
                <Link href={`/companies/${job.company.slug}`} className="hover:text-pine hover:underline">
                  {job.company.name}
                </Link>{" "}
                · {job.location ?? tf("remote")}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  tf(`workModel.${job.workModel}`),
                  tf(`seniority.${job.seniority}`),
                  job.language.toUpperCase(),
                ].map((b) => (
                  <span
                    key={b}
                    className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-muted"
                  >
                    {b}
                  </span>
                ))}
                {job.daysLeft !== null && job.daysLeft <= 7 && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {tf("daysLeft", { days: job.daysLeft })}
                  </span>
                )}
              </div>
            </div>
            {favoriteJobIds && (
              <FavoriteButton
                jobId={job.id}
                initiallyFavorited={favoriteJobIds.includes(job.id)}
                className="shrink-0 border border-line bg-white shadow-sm"
              />
            )}
          </div>

          <section className="mt-8">
            <h2 className="font-display text-sm font-semibold tracking-wide text-muted">
              {t("stack")}
            </h2>
            <div className="mt-2">
              <TechTags tech={job.tech} />
            </div>
          </section>

          {job.requiredLanguages.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-sm font-semibold tracking-wide text-muted">
                {tjf("requiredLanguages")}
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.requiredLanguages.map((lang) => (
                  <span
                    key={lang.slug}
                    className="rounded-md border border-line bg-white px-2 py-0.5 text-xs text-muted"
                  >
                    {lang.label}
                    {lang.level ? ` — ${tjf(`levelOption.${lang.level}`)}` : ""}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">
              {t("aboutRole")}
            </h2>
            <div className="mt-2">
              <JobDescriptionBody description={job.description} />
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-display text-xs font-semibold tracking-wide text-muted uppercase">
              {t("salaryHeading")}
            </h2>
            <div className="mt-2">
              <Salary
                min={job.salaryMin}
                max={job.salaryMax}
                period={job.salaryPeriod}
                months={job.salaryMonths}
                employmentType={job.employmentType}
                size="detail"
              />
            </div>
            <ApplyModal
              jobSlug={slug}
              companyName={job.company.name}
              isCandidate={applyStatus.isCandidate}
              alreadyApplied={applyStatus.alreadyApplied}
              externalApplyUrl={job.externalApplyUrl}
            />
            {expiryPercent !== null && (
              <div className="mt-3">
                <JobExpiryBar percentLeft={expiryPercent} />
                {job.daysLeft !== null && (
                  <p className="mt-1 text-center text-[11px] text-muted">
                    {tf("daysLeft", { days: job.daysLeft })}
                  </p>
                )}
              </div>
            )}
            <p className="mt-3 text-center text-xs text-muted">
              {tf("postedAgo", { days: job.postedDaysAgo })}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
