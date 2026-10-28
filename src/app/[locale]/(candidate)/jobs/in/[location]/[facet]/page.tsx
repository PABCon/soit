import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBrowseJobs } from "@/lib/db/jobs";
import { JobFeed } from "@/components/JobFeed";
import { localeAlternates, socialMeta } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; location: string; facet: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

// SEO audit finding: same gap as the plain location browse page — this
// template had no description/canonical/hreflang/OG at all. Fixed once
// here so every current and future location×facet combination (no
// per-page work needed) gets it automatically.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, location, facet } = await params;
  const result = await getBrowseJobs(resolveParams(location, facet));
  if (!result) return {};
  const place = result.locationName ?? "Portugal";
  const facetLabel = await resolveFacetLabel(locale, result);
  const t = await getTranslations({ locale, namespace: "feed" });
  const title = `${facetLabel} jobs in ${place} — Just IT`;
  const description = t("browseFacetMetaDescription", { count: result.jobs.length, facet: facetLabel, place });
  return {
    title,
    description,
    alternates: localeAlternates(`/jobs/in/${location}/${facet}`, locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/jobs/in/${location}/${facet}` }),
    ...(result.jobs.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
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
          <h1 className="text-3xl font-bold lg:text-4xl">
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
