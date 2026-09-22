import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCompanyBySlug } from "@/lib/db/companies";
import { getLiveJobs } from "@/lib/db/jobs";
import { CompanyLogo } from "@/components/CompanyLogo";
import { JobRow } from "@/components/JobRow";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return {};
  return { title: company.name, description: company.description ?? undefined };
}

const SOCIAL_ICONS: { key: "facebookUrl" | "linkedinUrl" | "instagramUrl" | "youtubeUrl" | "tiktokUrl" | "xUrl"; path: string }[] = [
  { key: "facebookUrl", path: "M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h2.5l.5-3H14V9.5c0-.3.2-.5.5-.5Z" },
  {
    key: "linkedinUrl",
    path: "M6.5 8.5h3V18h-3V8.5Zm1.5-4a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4ZM11.5 8.5h2.9v1.3h.04c.4-.75 1.4-1.55 2.9-1.55 3.1 0 3.66 2 3.66 4.7V18h-3v-4.4c0-1.05-.02-2.4-1.46-2.4-1.47 0-1.7 1.15-1.7 2.33V18h-3V8.5Z",
  },
  {
    key: "instagramUrl",
    path: "M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Zm4 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm4.6-.9a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0Z",
  },
  { key: "youtubeUrl", path: "M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5v-7ZM10 9.5v5l5-2.5-5-2.5Z" },
  {
    key: "tiktokUrl",
    path: "M14 4h2.2c.2 1.6 1.3 2.9 3 3.2v2.2c-1.1 0-2.2-.35-3-1v5.3a4.3 4.3 0 1 1-4.3-4.3c.15 0 .3 0 .45.02v2.25a2.05 2.05 0 1 0 1.65 2.03V4Z",
  },
  { key: "xUrl", path: "m5 5 6 8-6.3 6h1.7L11.9 14 15.5 19H19l-6.3-8.5L19 5h-1.7L12.1 10.5 8.5 5H5Z" },
];

/** Public, indexable company page (§7.1) — a key SEO + employer-branding
 *  asset, and the target of every job's JSON-LD `sameAs`. Redesigned per
 *  real-usage QA (justjoin.it/rocketjobs.com reference): banner + circular
 *  logo overlap, social links, and a stat-card row derived from live jobs. */
export default async function CompanyPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "company" });

  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const jobs = (await getLiveJobs()).filter((j) => j.company.slug === slug);
  const officeLocations = [...new Set(jobs.map((j) => j.location).filter((l): l is string => !!l))].slice(0, 3);

  const socialLinks = SOCIAL_ICONS.map(({ key, path }) => ({ path, url: company[key] })).filter(
    (s): s is { path: string; url: string } => !!s.url,
  );

  const statCards = [
    { label: t("officeLocations"), value: officeLocations.length ? officeLocations.join(", ") : null },
    { label: t("activeOffers"), value: String(jobs.length) },
    { label: t("companyType"), value: company.companyType },
    { label: t("industry"), value: company.industry },
  ].filter((c) => c.value !== null);

  return (
    <>
      <div className="relative">
        {company.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.coverImageUrl}
            alt=""
            className="h-48 w-full rounded-xl object-cover sm:h-64"
          />
        ) : (
          <div className="h-48 w-full rounded-xl bg-gradient-to-br from-pine to-mint sm:h-64" aria-hidden="true" />
        )}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
          <CompanyLogo company={company} size="xl" shape="circle" />
        </div>
      </div>

      <div className="mt-14 flex flex-col items-center text-center">
        {socialLinks.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                title={company.website}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-muted transition-colors hover:bg-pine hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.5 2.7 4 6 4 9s-1.5 6.3-4 9c-2.5-2.7-4-6-4-9s1.5-6.3 4-9Z" />
                </svg>
              </a>
            )}
            {socialLinks.map(({ path, url }, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-muted transition-colors hover:bg-pine hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d={path} />
                </svg>
              </a>
            ))}
          </div>
        )}

        <h1 className="font-display text-2xl font-bold">{company.name}</h1>

        {company.description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{company.description}</p>
        )}
      </div>

      {statCards.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-line bg-white px-4 py-3 text-center">
              <p className="text-xs text-muted">{card.label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink" title={card.value ?? undefined}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">
          {t("openJobs", { count: jobs.length })}
        </h2>
        {jobs.length > 0 ? (
          <ul className="mt-4 border-t border-line">
            {jobs.map((job) => (
              <JobRow key={job.slug} job={job} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">{t("noOpenJobs")}</p>
        )}
      </section>
    </>
  );
}
