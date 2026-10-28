import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CompanyProfileBody, getCompanyPageMetadata } from "@/components/candidate/CompanyProfileBody";
import { getCompanyBySlug } from "@/lib/db/companies";
import { safeJsonLd } from "@/lib/json-ld";

type Props = { params: Promise<{ locale: string; slug: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return getCompanyPageMetadata(slug, locale);
}

/** SEO audit finding: each company is only ever referenced *from* a job's
 *  JSON-LD `sameAs` — the company's own page carried no structured data of
 *  its own, even though every field here is already fetched on this exact
 *  page. Deliberately only on the real public page, not the noindex
 *  preview route sharing CompanyProfileBody — a preview sandbox shouldn't
 *  emit real-looking structured data for a company that hasn't finished
 *  setting up its profile yet. */
function companyJsonLd(company: NonNullable<Awaited<ReturnType<typeof getCompanyBySlug>>>, locale: string) {
  const sameAs = [company.website, company.linkedinUrl, company.facebookUrl, company.instagramUrl, company.youtubeUrl].filter(
    (url): url is string => !!url,
  );
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    url: `${SITE}/${locale}/companies/${company.slug}`,
    ...(company.logoUrl ? { logo: company.logoUrl } : {}),
    ...(company.description ? { description: company.description } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/** Public, indexable company page (§7.1) — a key SEO + employer-branding
 *  asset, and the target of every job's JSON-LD `sameAs`. Content lives in
 *  CompanyProfileBody, shared with the noindex preview route opened from
 *  the employer console (`(preview)/companies/[slug]/preview`). */
export default async function CompanyPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const company = await getCompanyBySlug(slug);

  return (
    <>
      {company && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(companyJsonLd(company, locale)) }}
        />
      )}
      <CompanyProfileBody locale={locale} slug={slug} showBackLink />
    </>
  );
}
