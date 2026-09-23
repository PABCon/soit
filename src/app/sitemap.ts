import type { MetadataRoute } from "next";
import { getLiveJobs } from "@/lib/db/jobs";
import { getVerifiedCompanies } from "@/lib/db/companies";
import { routing } from "@/i18n/routing";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function forEachLocale(path: string): MetadataRoute.Sitemap {
  return routing.locales.map((locale) => ({ url: `${SITE}/${locale}${path}` }));
}

/**
 * Static pages, every live job/company detail page, and browse-page URLs —
 * but only the location/category combinations that currently have ≥1 live
 * job. The full taxonomy cross-product (14 locations × ~14 categories,
 * plus 159 tech tags) would be mostly empty pages; publishing thousands of
 * those to search engines is actively bad for SEO, not just wasted effort.
 * Tech-slug browse pages exist and are reachable (`/jobs/in/[location]/
 * [tech]`) but aren't enumerated here yet — `Job.tech` only carries display
 * labels today, not slugs, so building that list would need extra plumbing
 * for a near-empty dataset; revisit once there's real tech-tagged volume.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, companies] = await Promise.all([getLiveJobs(), getVerifiedCompanies()]);

  const staticPages = ["", "/jobs", "/companies", "/map"].flatMap(forEachLocale);
  const jobPages = jobs.flatMap((j) => forEachLocale(`/jobs/${j.slug}`));
  const companyPages = companies.flatMap((c) => forEachLocale(`/companies/${c.slug}`));

  const locationSlugs = new Set<string>();
  const categorySlugs = new Set<string>();
  const locationCategoryPairs = new Set<string>();
  for (const job of jobs) {
    if (job.locationSlug) locationSlugs.add(job.locationSlug);
    if (job.categorySlug) categorySlugs.add(job.categorySlug);
    if (job.locationSlug && job.categorySlug) {
      locationCategoryPairs.add(`${job.locationSlug}/${job.categorySlug}`);
    }
  }

  const locationPages = [...locationSlugs].flatMap((slug) => forEachLocale(`/jobs/in/${slug}`));
  const allLocationsCategoryPages = [...categorySlugs].flatMap((slug) =>
    forEachLocale(`/jobs/in/all-locations/${slug}`),
  );
  const locationCategoryPages = [...locationCategoryPairs].flatMap((pair) => forEachLocale(`/jobs/in/${pair}`));

  return [
    ...staticPages,
    ...jobPages,
    ...companyPages,
    ...locationPages,
    ...allLocationsCategoryPages,
    ...locationCategoryPages,
  ];
}
