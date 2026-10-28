import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getBrowseJobs } from "@/lib/db/jobs";
import { JobFeed } from "@/components/JobFeed";
import { localeAlternates, socialMeta } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; location: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// SEO audit finding: this template drives this app's entire long-tail
// SEO play (justjoin.it-style "IT jobs in Lisbon" pages) — ~70+ of these
// are already in the sitemap and the count grows with every new job, but
// the template had no description/canonical/hreflang/OG at all, so every
// one of them fell back to the root layout's homepage alternates. Fixed
// once, here, so every current AND future location (no per-page work
// needed as new cities/jobs appear) gets it automatically.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, location } = await params;
  const result = await getBrowseJobs({ locationSlug: location });
  if (!result) return {};
  const t = await getTranslations({ locale, namespace: "feed" });
  const place = result.locationName ?? "";
  const title = `IT jobs in ${place} — Just IT`;
  const description = t("browseLocationMetaDescription", { count: result.jobs.length, place });
  return {
    title,
    description,
    alternates: localeAlternates(`/jobs/in/${location}`, locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/jobs/in/${location}` }),
    // A combo reachable by direct URL but not currently in the sitemap
    // (zero live jobs right now) shouldn't rank on an empty page — but it
    // must still render a real 200, not 404, since the taxonomy itself is
    // legitimate before it's populated (existing design, see getBrowseJobs).
    ...(result.jobs.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
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
          <h1 className="text-3xl font-bold lg:text-4xl">{t("jobsIn", { place: result.locationName ?? "" })}</h1>
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
