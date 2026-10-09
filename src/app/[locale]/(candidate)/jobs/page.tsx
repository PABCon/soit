import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobsExplorer } from "@/components/JobsExplorer";
import { RecommendationsTeaser } from "@/components/candidate/RecommendationsTeaser";
import { Link } from "@/i18n/navigation";
import { getLiveJobs } from "@/lib/db/jobs";
import { getFeaturedTechCounts } from "@/lib/db/tech-tags";
import { getJobCategories } from "@/lib/db/job-categories";
import { getLocations } from "@/lib/db/locations";
import { getMyFavoriteJobIds } from "@/lib/db/favorites";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "jobs" });
  return { title: t("title") };
}

export default async function JobsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "jobs" });
  const tf = await getTranslations({ locale, namespace: "feed" });
  const tjf = await getTranslations({ locale, namespace: "jobForm" });
  const [jobs, featuredTech, categories, locations, favoriteJobIds] = await Promise.all([
    getLiveJobs(),
    getFeaturedTechCounts(),
    getJobCategories(),
    getLocations(),
    getMyFavoriteJobIds(),
  ]);

  // Only locations/categories/languages that currently have a live job get
  // a link — never advertise an empty browse page (§ SEO note in
  // sitemap.ts). This "Browse by" section is separate from — and stays
  // alongside — JobsExplorer's own curated quick-filter row: these are
  // real server-rendered links to dedicated, crawlable /jobs/in/... pages
  // (SEO), not a client-side refinement of the page you're already on.
  // "Browse by technology" was removed per real-usage feedback — location/
  // category/language cover the useful cases; the generic technology list
  // read as redundant clutter next to JobsExplorer's own tech filter row.
  const locationCounts = new Map<string, { name: string; count: number }>();
  const categoryCounts = new Map<string, number>();
  for (const job of jobs) {
    if (job.locationSlug && job.location) {
      const entry = locationCounts.get(job.locationSlug);
      locationCounts.set(job.locationSlug, { name: job.location, count: (entry?.count ?? 0) + 1 });
    }
    if (job.categorySlug) {
      categoryCounts.set(job.categorySlug, (categoryCounts.get(job.categorySlug) ?? 0) + 1);
    }
  }
  const topLocations = [...locationCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);
  const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topLanguages = featuredTech.filter((t) => t.group === "language");

  return (
    <>
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-4">
        <RecommendationsTeaser />
      </div>

      <div className="mt-6">
        <JobsExplorer
          jobs={jobs}
          featuredTech={featuredTech}
          categories={categories}
          locations={locations}
          favoriteJobIds={favoriteJobIds}
        />
      </div>

      {(topLocations.length > 0 || topCategories.length > 0 || topLanguages.length > 0) && (
        <div className="mt-10 grid grid-cols-1 gap-6 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {topLocations.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted">{tf("browseByLocation")}</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {topLocations.map(([slug, { name }]) => (
                  <li key={slug}>
                    <Link
                      href={`/jobs/in/${slug}`}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted hover:border-muted hover:text-ink"
                    >
                      {name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topCategories.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted">{tf("browseByCategory")}</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {topCategories.map(([slug]) => (
                  <li key={slug}>
                    <Link
                      href={`/jobs/in/all-locations/${slug}`}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted hover:border-muted hover:text-ink"
                    >
                      {tjf(`categoryOption.${slug}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topLanguages.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted">{tf("browseByLanguage")}</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {topLanguages.map(({ slug, label }) => (
                  <li key={slug}>
                    <Link
                      href={`/jobs/in/all-locations/${slug}`}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted hover:border-muted hover:text-ink"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
