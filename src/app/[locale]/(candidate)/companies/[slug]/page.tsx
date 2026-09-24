import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CompanyProfileBody, getCompanyPageMetadata } from "@/components/candidate/CompanyProfileBody";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return getCompanyPageMetadata(slug);
}

/** Public, indexable company page (§7.1) — a key SEO + employer-branding
 *  asset, and the target of every job's JSON-LD `sameAs`. Content lives in
 *  CompanyProfileBody, shared with the noindex preview route opened from
 *  the employer console (`(preview)/companies/[slug]/preview`). */
export default async function CompanyPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <CompanyProfileBody locale={locale} slug={slug} />;
}
