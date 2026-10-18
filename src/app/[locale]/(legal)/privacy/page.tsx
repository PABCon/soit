import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobDescriptionBody } from "@/components/JobDescriptionBody";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("privacyTitle") };
}

const h2Class = "font-display mt-8 text-lg font-semibold text-ink";
const draftNoticeClass = "rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800";

const SECTIONS = [
  "controller",
  "data",
  "bases",
  "cookies",
  "sharing",
  "transfers",
  "retention",
  "rights",
  "security",
  "changes",
  "contact",
] as const;

/** Real policy content, grounded in a direct codebase audit of what this app
 *  actually collects/stores/sends to third parties — replaces the old
 *  "this page is being prepared" placeholder. Still explicitly flagged (top
 *  and bottom) as AI-drafted and pending a lawyer's review — not presented
 *  as finalized legal text. */
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <>
      <h1 className="text-3xl font-bold lg:text-4xl">{t("privacyTitle")}</h1>
      <p className="mt-2 text-xs text-muted">{t("lastUpdated")}</p>
      <div className={`mt-4 ${draftNoticeClass}`}>{t("draftNotice")}</div>
      <p className="mt-6 text-sm leading-relaxed text-muted">{t("privacy.intro")}</p>
      {SECTIONS.map((key) => (
        <section key={key}>
          <h2 className={h2Class}>{t(`privacy.${key}Heading`)}</h2>
          <div className="mt-2">
            <JobDescriptionBody description={t(`privacy.${key}Body`)} />
          </div>
        </section>
      ))}
      <div className={`mt-8 ${draftNoticeClass}`}>{t("draftNotice")}</div>
    </>
  );
}
