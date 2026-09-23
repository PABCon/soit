import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBrowseJobs } from "@/lib/db/jobs";
import { JobFeed } from "@/components/JobFeed";

type Props = { params: Promise<{ locale: string; location: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location } = await params;
  const result = await getBrowseJobs({ locationSlug: location });
  if (!result) return {};
  return { title: `IT jobs in ${result.locationName} — SóIT` };
}

/** justjoin.it-style browse page — `/jobs/in/lisboa`. `/jobs/[slug]` already
 *  owns job detail pages, so this lives under a static `in/` segment to
 *  avoid colliding with that dynamic route (§7.1). */
export default async function JobsInLocationPage({ params }: Props) {
  const { locale, location } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "feed" });

  const result = await getBrowseJobs({ locationSlug: location });
  if (!result) notFound();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("jobsIn", { place: result.locationName ?? "" })}</h1>
        </div>
        <Link
          href="/jobs"
          className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:border-muted"
        >
          {t("allJobs")}
        </Link>
      </div>

      <div className="mt-6">
        <JobFeed jobs={result.jobs} />
      </div>
    </>
  );
}
