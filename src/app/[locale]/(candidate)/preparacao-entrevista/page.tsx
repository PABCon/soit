import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { buttonClassName } from "@/components/Button";
import { InterviewPrepBooking } from "@/components/candidate/InterviewPrepBooking";
import { minBookableDate } from "@/lib/db/interview-prep";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "interviewPrep" });
  const title = t("pageTitle");
  const description = t("pageDescription");
  return {
    title,
    description,
    alternates: localeAlternates("/preparacao-entrevista", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/preparacao-entrevista` }),
  };
}

const TIP_ROWS = [
  ["starTerm", "starBody"],
  ["researchTerm", "researchBody"],
  ["questionsTerm", "questionsBody"],
] as const;

/**
 * Interview prep booking (growth plan, Track C) — public page, SEO
 * content throughout so it works as a destination for an anonymous
 * visitor too, but the actual booking form is gated behind a candidate
 * session (direct instruction) — reuses the exact auth-check shape
 * /favorites already established, just without the hard redirect, since
 * this page needs to stay reachable and indexable for someone who hasn't
 * registered yet.
 */
export default async function InterviewPrepPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "interviewPrep" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: candidateId } = user ? await supabase.rpc("my_candidate_id") : { data: null };

  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("heading")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink">{t("introP1")}</p>

      <div className="mt-8">
        {candidateId ? (
          <InterviewPrepBooking minDate={minBookableDate()} />
        ) : (
          <div className="rounded-2xl border border-line bg-paper p-8 text-center">
            <h2 className="font-display text-lg font-bold text-ink">{t("pitchTitle")}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{t("pitchBody")}</p>
            <Link href="/candidate/register" className={`mt-6 inline-block ${buttonClassName({ size: "lg" })}`}>
              {t("createAccount")}
            </Link>
            <p className="mt-3 text-xs text-muted">
              {t("alreadyHaveAccount")}{" "}
              <Link href="/candidate/login" className="font-medium text-pine hover:underline">
                {t("logIn")}
              </Link>
            </p>
          </div>
        )}
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">{t("tipsHeading")}</h2>
      <dl className="mt-4 space-y-5">
        {TIP_ROWS.map(([term, body]) => (
          <div key={term}>
            <dt className="font-semibold text-ink">{t(term)}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t(body)}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
