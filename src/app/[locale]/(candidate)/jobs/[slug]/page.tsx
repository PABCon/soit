import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Salary } from "@/components/Salary";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TechTags } from "@/components/TechTags";
import { JOBS, type Job } from "@/lib/jobs";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string; slug: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    JOBS.map((job) => ({ locale, slug: job.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const job = JOBS.find((j) => j.slug === slug);
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

function jobPostingJsonLd(job: Job, locale: string) {
  const posted = new Date(Date.now() - job.postedDaysAgo * 864e5);
  const valid = new Date(posted.getTime() + 30 * 864e5);

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `${job.title} — ${job.company.name}. ${job.tech.join(", ")}.`,
    datePosted: posted.toISOString().slice(0, 10),
    validThrough: valid.toISOString().slice(0, 10),
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
  };
}

export default async function JobDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const job = JOBS.find((j) => j.slug === slug);
  if (!job) notFound();

  const t = await getTranslations({ locale, namespace: "job" });
  const tf = await getTranslations({ locale, namespace: "feed" });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobPostingJsonLd(job, locale)),
        }}
      />

      <Link href="/jobs" className="text-sm text-muted hover:text-ink">
        ← {t("backToJobs")}
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <CompanyLogo company={job.company} size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold">{job.title}</h1>
              <p className="mt-1 text-muted">
                {job.company.name} · {job.location ?? tf("remote")}
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
              </div>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="font-display text-sm font-semibold tracking-wide text-muted">
              {t("stack")}
            </h2>
            <div className="mt-2">
              <TechTags tech={job.tech} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">
              {t("aboutRole")}
            </h2>
            {/* Placeholder copy — real descriptions are employer-authored HTML
                from the posting form, sanitised server-side (§15.1). */}
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t("placeholder")}
            </p>
            <h3 className="mt-6 font-display text-sm font-semibold">
              {t("requirements")}
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {job.tech.map((tech) => (
                <li key={tech} className="flex gap-2">
                  <span className="text-pine">·</span>
                  {tech}
                </li>
              ))}
            </ul>
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
            <button
              type="button"
              className="mt-5 h-11 w-full rounded-lg bg-pine text-sm font-semibold text-white hover:bg-pine/90"
            >
              {t("apply")}
            </button>
            <p className="mt-3 text-center text-xs text-muted">
              {tf("postedAgo", { days: job.postedDaysAgo })}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
