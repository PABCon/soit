import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobsExplorer, type QuickFilterOption } from "@/components/JobsExplorer";
import { RecommendationsTeaser } from "@/components/candidate/RecommendationsTeaser";
import { Link } from "@/i18n/navigation";
import { getLiveJobs } from "@/lib/db/jobs";
import { getFeaturedTechCounts, getTechTags } from "@/lib/db/tech-tags";
import { getJobCategories } from "@/lib/db/job-categories";
import { getLocations } from "@/lib/db/locations";
import { getSpokenLanguages } from "@/lib/db/spoken-languages";
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
  const tf = await getTranslations({ locale, namespace: "feed" });
  const tjf = await getTranslations({ locale, namespace: "jobForm" });
  const [jobs, featuredTech, techTags, categories, locations, spokenLanguages, favoriteJobIds] = await Promise.all([
    getLiveJobs(),
    getFeaturedTechCounts(),
    getTechTags(),
    getJobCategories(),
    getLocations(),
    getSpokenLanguages(),
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
  const techLabelCounts = new Map<string, number>();
  for (const job of jobs) {
    if (job.locationSlug && job.location) {
      const entry = locationCounts.get(job.locationSlug);
      locationCounts.set(job.locationSlug, { name: job.location, count: (entry?.count ?? 0) + 1 });
    }
    if (job.categorySlug) {
      categoryCounts.set(job.categorySlug, (categoryCounts.get(job.categorySlug) ?? 0) + 1);
    }
    for (const label of job.tech) {
      techLabelCounts.set(label, (techLabelCounts.get(label) ?? 0) + 1);
    }
  }
  const topLocations = [...locationCounts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);
  const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topLanguages = featuredTech.filter((t) => t.group === "language");

  // Round-5 feedback: the old curated ~20-tag quick-filter row still
  // surfaced low-signal entries (e.g. "SQL") while hiding genuinely
  // common ones outside that curated subset — replaced with a dynamic
  // top-N ranked by actual live job count, merging the full tech-tag
  // vocabulary with every category (no curation subset at all), capped
  // at 20, computed once here from the same `jobs` array already fetched
  // — no new count query needed, same pattern as topLocations/
  // topCategories above.
  const techSlugByLabel = new Map(techTags.map((tag) => [tag.label, tag.slug]));
  const quickFilters: QuickFilterOption[] = [
    ...[...techLabelCounts.entries()].map(([label, count]) => ({
      kind: "tech" as const,
      slug: techSlugByLabel.get(label) ?? label,
      label,
      count,
    })),
    ...categories
      .filter((c) => categoryCounts.has(c.slug))
      .map((c) => ({ kind: "category" as const, slug: c.slug, label: c.label, count: categoryCounts.get(c.slug)! })),
  ]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 20);

  return (
    <>
      {/* Round-6 feedback: the "IT jobs" page heading was called out as
       *  useless and removed outright — a real tradeoff, noted rather than
       *  silently accepted: this page no longer has an <h1> of its own,
       *  which matters for SEO/accessibility in general (a landmark
       *  heading is normally expected on every page), but it's what was
       *  explicitly asked for. */}
      <RecommendationsTeaser />

      <div className="mt-6">
        <JobsExplorer
          jobs={jobs}
          quickFilters={quickFilters}
          locations={locations}
          spokenLanguages={spokenLanguages}
          favoriteJobIds={favoriteJobIds}
        />
      </div>

      {(topLocations.length > 0 || topCategories.length > 0 || topLanguages.length > 0) && (
        <div className="mt-10 grid grid-cols-1 gap-6 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {topLocations.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">{tf("browseByLocation")}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {topLocations.map(([slug, { name }]) => (
                  <li key={slug}>
                    <Link
                      href={`/jobs/in/${slug}`}
                      className="flex h-8 items-center rounded-lg border border-line bg-white px-3 text-xs font-medium text-[#475467] transition-colors hover:border-pine/30 hover:bg-subtle hover:text-pine"
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
              <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">{tf("browseByCategory")}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {topCategories.map(([slug]) => (
                  <li key={slug}>
                    <Link
                      href={`/jobs/in/all-locations/${slug}`}
                      className="flex h-8 items-center rounded-lg border border-line bg-white px-3 text-xs font-medium text-[#475467] transition-colors hover:border-pine/30 hover:bg-subtle hover:text-pine"
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
              <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">{tf("browseByLanguage")}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {topLanguages.map(({ slug, label }) => (
                  <li key={slug}>
                    <Link
                      href={`/jobs/in/all-locations/${slug}`}
                      className="flex h-8 items-center rounded-lg border border-line bg-white px-3 text-xs font-medium text-[#475467] transition-colors hover:border-pine/30 hover:bg-subtle hover:text-pine"
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
