import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: t("termsTitle") };
}

/** Placeholder — real terms content is separate, tracked backlog (§9
 *  compliance pass in CLAUDE.md), not written here. Deliberately not real
 *  legal copy. */
export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <>
      <h1 className="text-2xl font-bold">{t("termsTitle")}</h1>
      <p className="mt-4 text-sm text-muted">{t("placeholderBody")}</p>
    </>
  );
}
