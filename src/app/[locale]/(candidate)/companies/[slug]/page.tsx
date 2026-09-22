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

/** Public, indexable company page (§7.1) — a key SEO + employer-branding
 *  asset, and the target of every job's JSON-LD `sameAs`. */
export default async function CompanyPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "company" });

  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const jobs = (await getLiveJobs()).filter((j) => j.company.slug === slug);

  return (
    <>
      {company.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={company.coverImageUrl}
          alt=""
          className="mb-6 h-40 w-full rounded-xl object-cover"
        />
      )}

      <div className="flex items-start gap-4">
        <CompanyLogo company={company} size="lg" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold">{company.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {[company.industry, company.companySize].filter(Boolean).join(" · ")}
          </p>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm text-pine hover:underline"
            >
              {company.website}
            </a>
          )}
        </div>
      </div>

      {company.description && (
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">{company.description}</p>
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
