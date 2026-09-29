import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getJobRecommendationsForCandidate } from "@/lib/db/recommendations";
import { getMyFavoriteJobIds } from "@/lib/db/favorites";
import { JobRow } from "@/components/JobRow";

type Props = { params: Promise<{ locale: string }> };
type T = Awaited<ReturnType<typeof getTranslations>>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recommendations" });
  return { title: t("title") };
}

/** A landing/teaser view for anyone without a candidate profile — the
 *  destination of the Rail's "clickbait" entry and the homepage banner,
 *  so it has to work for a genuinely anonymous "ad click," not just as a
 *  logged-in feature. Honest marketing copy, no fake numbers. */
function Pitch({ t }: { t: T }) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">{t("pitchTitle")}</h1>
      <p className="mt-3 text-muted">{t("pitchBody")}</p>
      <ul className="mt-6 space-y-2 text-left text-sm text-ink">
        <li className="flex items-start gap-2">
          <span aria-hidden className="text-pine">
            ✓
          </span>
          {t("pitchBullet1")}
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="text-pine">
            ✓
          </span>
          {t("pitchBullet2")}
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="text-pine">
            ✓
          </span>
          {t("pitchBullet3")}
        </li>
      </ul>
      <Link
        href="/candidate/register"
        className="mt-8 flex h-12 w-full items-center justify-center rounded-lg bg-pine text-sm font-semibold text-white hover:bg-pine/90"
      >
        {t("createAccount")}
      </Link>
      <Link href="/candidate/login" className="mt-3 block text-sm text-muted hover:text-ink hover:underline">
        {t("alreadyHaveAccount")}
      </Link>
    </div>
  );
}

function EmptyProfilePrompt({ t }: { t: T }) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">{t("emptyProfileTitle")}</h1>
      <p className="mt-3 text-muted">{t("emptyProfileBody")}</p>
      <Link
        href="/profile"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-pine px-6 text-sm font-semibold text-white hover:bg-pine/90"
      >
        {t("completeProfile")}
      </Link>
    </div>
  );
}

/** Skills alone aren't enough — preferences are enforced too, since a
 *  candidate with skills but no scope (categories/locations/work model/
 *  salary) is exactly the profile shape that produced a real bad match
 *  (a business/delivery background matched to a "Senior Big Data
 *  Engineer" role) before this was tightened. */
function NoPreferencesPrompt({ t }: { t: T }) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">{t("noPreferencesTitle")}</h1>
      <p className="mt-3 text-muted">{t("noPreferencesBody")}</p>
      <Link
        href="/profile?tab=preferences"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-pine px-6 text-sm font-semibold text-white hover:bg-pine/90"
      >
        {t("setPreferences")}
      </Link>
    </div>
  );
}

export default async function RecommendationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "recommendations" });

  const result = await getJobRecommendationsForCandidate();

  if (!result.ok && result.reason === "not_a_candidate") return <Pitch t={t} />;
  if (!result.ok && result.reason === "empty_profile") return <EmptyProfilePrompt t={t} />;
  if (!result.ok) return <NoPreferencesPrompt t={t} />;

  const favoriteJobIds = await getMyFavoriteJobIds();

  return (
    <>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

      {result.jobs.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("noMatches")}</p>
      ) : (
        <ul className="mt-6 border-t border-line">
          {result.jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              isFavorited={favoriteJobIds?.includes(job.id) ?? false}
              matchScore={job.matchScore}
            />
          ))}
        </ul>
      )}
    </>
  );
}
