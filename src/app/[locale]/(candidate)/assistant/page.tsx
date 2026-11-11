import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AssistantChat } from "@/components/candidate/AssistantChat";
import { localeAlternates, socialMeta } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "assistant" });
  const title = t("pageTitle");
  const description = t("pageDescription");
  return {
    title,
    description,
    // Not a real content/SEO page like the calculators, just a tool
    // surface, same `noindex` treatment the console gets, since there's
    // nothing here search engines should index (every real job is
    // already indexed at its own canonical /jobs/[slug] URL).
    robots: { index: false, follow: false },
    alternates: localeAlternates("/assistant", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/assistant` }),
  };
}

/** Chat assistant, Phase 1 (search/discovery only): a dedicated, Claude-
 *  style single-window chat where a candidate searches for jobs via
 *  natural language instead of the manual /jobs filter UI. Anonymous-
 *  accessible, session-only (no persisted history, no new DB table).
 *  Apply-via-chat, persisted history, and any employer-side action are
 *  explicitly later phases, not built here. */
export default async function AssistantPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "assistant" });

  return (
    <>
      <h1 className="font-display text-2xl font-bold">{t("heading")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("subtitle")}</p>
      <div className="mt-6">
        <AssistantChat />
      </div>
    </>
  );
}
