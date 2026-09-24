import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CompanyProfileBody, getCompanyPageMetadata } from "@/components/candidate/CompanyProfileBody";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getCompanyPageMetadata(slug);
  return { ...meta, robots: { index: false, follow: false } };
}

/** Noindex twin of the public company page (§7.1), opened in a new tab from
 *  the employer console's "Ver perfil público" — same content via
 *  CompanyProfileBody, wrapped in the minimal (preview) layout instead of
 *  the full candidate shell, so it can't be used to wander into the main
 *  site's nav (see (preview)/layout.tsx). */
export default async function CompanyPreviewPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <CompanyProfileBody locale={locale} slug={slug} />;
}
