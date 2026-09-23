import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBrowseJobs } from "@/lib/db/jobs";
import { JobFeed } from "@/components/JobFeed";

type Props = { params: Promise<{ locale: string; location: string; facet: string }> };

function resolveParams(location: string, facet: string) {
  return { locationSlug: location === "all-locations" ? undefined : location, facetSlug: facet };
}

async function resolveFacetLabel(
  locale: string,
  result: { facetKind: "category" | "tech" | null; facetSlug: string | null; facetLabel: string | null },
): Promise<string> {
  if (result.facetKind === "category" && result.facetSlug) {
    const tf = await getTranslations({ locale, namespace: "jobForm" });
    return tf(`categoryOption.${result.facetSlug}`);
  }
  return result.facetLabel ?? "";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, location, facet } = await params;
  const result = await getBrowseJobs(resolveParams(location, facet));
  if (!result) return {};
  const place = result.locationName ?? "Portugal";
  const facetLabel = await resolveFacetLabel(locale, result);
  return { title: `${facetLabel} jobs in ${place} — SóIT` };
}

/** justjoin.it-style browse page — `/jobs/in/lisboa/react` or `/jobs/in/
 *  all-locations/devops-cloud`. `facet` resolves against job_categories
 *  first, then tech_tags — one shared URL slot for both taxonomies. */
export default async function JobsInLocationFacetPage({ params }: Props) {
  const { locale, location, facet } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "feed" });

  const result = await getBrowseJobs(resolveParams(location, facet));
  if (!result) notFound();

  const place = result.locationName ?? t("allLocations");
  const facetLabel = await resolveFacetLabel(locale, result);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {t("facetJobsIn", { facet: facetLabel, place })}
          </h1>
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
