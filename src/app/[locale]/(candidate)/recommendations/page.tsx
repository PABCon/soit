import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sparkles, UserPlus, Compass, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getJobRecommendationsForCandidate } from "@/lib/db/recommendations";
import { getMyFavoriteJobIds } from "@/lib/db/favorites";
import { JobRow } from "@/components/JobRow";
import { buttonClassName } from "@/components/Button";
import { localeAlternates, socialMeta } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };
type T = Awaited<ReturnType<typeof getTranslations>>;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recommendations" });
  const title = t("title");
  const description = t("metaDescription");
  return {
    title,
    description,
    // SEO audit finding: public (anonymous-visitor-reachable, per this
    // page's own design) but was falling back to the root layout's
    // homepage alternates — same gap as the other growth-funnel pages.
    alternates: localeAlternates("/recommendations", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/recommendations` }),
  };
}

/** Shared empty/teaser-state shell — the same icon-circle-in-a-white-card
 *  idiom the restyled messaging inbox (`MessagesInbox`) established for
 *  its own empty state, reused here for the three non-results branches
 *  below instead of each hand-rolling its own plain centered text block. */
function PromoCard({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-xl border border-line bg-white p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pine/10">
        <Icon className="h-7 w-7 text-pine" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-lg font-bold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {children}
    </div>
  );
}

/** A landing/teaser view for anyone without a candidate profile — the
 *  destination of the Rail's "clickbait" entry and the homepage banner,
 *  so it has to work for a genuinely anonymous "ad click," not just as a
 *  logged-in feature. Honest marketing copy, no fake numbers. */
function Pitch({ t }: { t: T }) {
  return (
    <PromoCard icon={Sparkles} title={t("pitchTitle")} body={t("pitchBody")}>
      <ul className="mt-5 space-y-2 text-left text-sm text-ink">
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
      <Link href="/candidate/register" className={buttonClassName({ size: "lg", className: "mt-6 w-full" })}>
        {t("createAccount")}
      </Link>
      <Link href="/candidate/login" className="mt-3 block text-sm text-muted hover:text-ink hover:underline">
        {t("alreadyHaveAccount")}
      </Link>
    </PromoCard>
  );
}

function EmptyProfilePrompt({ t }: { t: T }) {
  return (
    <PromoCard icon={UserPlus} title={t("emptyProfileTitle")} body={t("emptyProfileBody")}>
      <Link href="/profile" className={buttonClassName({ size: "md", className: "mt-6" })}>
        {t("completeProfile")}
      </Link>
    </PromoCard>
  );
}

/** Skills alone aren't enough — preferences are enforced too, since a
 *  candidate with skills but no scope (categories/locations/work model/
 *  salary) is exactly the profile shape that produced a real bad match
 *  (a business/delivery background matched to a "Senior Big Data
 *  Engineer" role) before this was tightened. */
function NoPreferencesPrompt({ t }: { t: T }) {
  return (
    <PromoCard icon={Compass} title={t("noPreferencesTitle")} body={t("noPreferencesBody")}>
      <Link href="/profile?tab=preferences" className={buttonClassName({ size: "md", className: "mt-6" })}>
        {t("setPreferences")}
      </Link>
    </PromoCard>
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
      <h1 className="text-3xl font-bold lg:text-4xl">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

      {result.jobs.length === 0 ? (
        <PromoCard icon={Compass} title={t("title")} body={t("noMatches")} />
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
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
