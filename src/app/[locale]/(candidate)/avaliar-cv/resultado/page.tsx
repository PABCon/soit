import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { claimCvReview } from "@/lib/db/cv-review";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cvReview" });
  return { title: t("resultPageTitle"), robots: { index: false, follow: false } };
}

const SECTION_KEYS = ["structure", "impact", "completeness"] as const;

/**
 * The claim moment — a real candidate session attaches the anonymous
 * review (uploaded before they ever registered) to their account and
 * reveals the full breakdown for the first time. Reached either straight
 * off the register/login flow via `next=`, or by revisiting the same link
 * later (claimCvReview is idempotent for the review's own owner).
 */
export default async function CvReviewResultPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: "cvReview" });

  if (!token) {
    redirect({ href: "/avaliar-cv", locale });
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: { pathname: "/candidate/login", query: { next: `/avaliar-cv/resultado?token=${token}` } }, locale });

  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) redirect({ href: "/avaliar-cv", locale });

  const claim = await claimCvReview(candidateId, token);

  if (!claim.ok) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-2xl font-bold">{t(`claimError.${claim.reason}`)}</h1>
      </div>
    );
  }

  const { overallScore, result } = claim;

  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("resultHeading")}</h1>

      <div className="mt-6 rounded-2xl border border-line bg-paper p-8 text-center">
        <p className="font-display text-6xl font-bold text-pine">{overallScore}</p>
        <p className="text-sm text-muted">/100</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {SECTION_KEYS.map((key) => (
          <div key={key} className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`section.${key}`)}</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">{result.sections[key].score}</p>
            <p className="mt-2 text-sm text-muted">{result.sections[key].note}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">{t("strengthsHeading")}</h2>
      <ul className="mt-4 space-y-2">
        {result.strengths.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink">
            <span className="text-pine">•</span>
            {s}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 font-display text-xl font-bold">{t("improvementsHeading")}</h2>
      <ul className="mt-4 space-y-2">
        {result.improvements.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink">
            <span className="text-pine">•</span>
            {s}
          </li>
        ))}
      </ul>
    </article>
  );
}
