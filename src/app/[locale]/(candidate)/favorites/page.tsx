import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyFavoriteJobs } from "@/lib/db/favorites";
import { JobRow } from "@/components/JobRow";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rail" });
  return { title: t("favorites"), robots: { index: false, follow: false } };
}

/** Saved jobs (§7.1, real-usage QA round 3 phase 3) — same shell as
 *  /applications, but rendered with the full JobRow card (salary, tech
 *  tags, urgency badge) since favorites carry the whole job, not just a
 *  status. Stays visible even once a job is no longer live, via the
 *  candidate_favorited_job() RLS policy. */
export default async function FavoritesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "favorites" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/candidate/login", locale });

  const jobs = await getMyFavoriteJobs();

  return (
    <>
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {jobs.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 border-t border-line">
          {jobs.map((job) => (
            <JobRow key={job.slug} job={job} isFavorited={true} />
          ))}
        </ul>
      )}
    </>
  );
}
