import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { JobDetailBody } from "@/components/JobDetailBody";
import { getJobForOwnerPreview, getSimilarJobs } from "@/lib/db/jobs";
import { getCompanyBySlug } from "@/lib/db/companies";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/** Opened in a new tab from `JobForm`'s own "Preview" button (real-usage
 *  ask: "it should open another tab and display as if it was like the real
 *  page") — same content via `JobDetailBody` as the real candidate-facing
 *  `(candidate)/jobs/[slug]` page, wrapped in the minimal `(preview)`
 *  layout instead, same precedent as the company-profile preview route.
 *  By id, not slug, and with no status/expiry filter
 *  (`getJobForOwnerPreview`) — a draft genuinely has no public slug route
 *  to open yet, and RLS (not this page) is what keeps someone else's job
 *  from being previewable: the owning employer's own session is what makes
 *  a draft resolve here at all. */
export default async function JobPreviewPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const job = await getJobForOwnerPreview(id);
  if (!job) notFound();

  const [similarJobs, companyProfile] = await Promise.all([
    getSimilarJobs(job),
    getCompanyBySlug(job.company.slug),
  ]);

  return (
    <JobDetailBody
      job={job}
      locale={locale}
      applyStatus={null}
      favoriteJobIds={null}
      similarJobs={similarJobs}
      companyProfile={companyProfile}
      preview
    />
  );
}
