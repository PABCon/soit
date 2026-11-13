import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AssistantChat } from "@/components/candidate/AssistantChat";
import { localeAlternates, socialMeta } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };

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
export default async function AssistantPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);

  // Real-usage feedback: the page's own "Ask, don't search" heading and
  // explainer paragraph, sitting above the chat, were both removed.
  // JT's own opening line inside the chat itself now carries that framing
  // ("Tell me your dream job"), and dropping this frees up enough vertical
  // space for the whole widget to fit the viewport without scrolling the
  // page to reach it. Same real tradeoff as the one already made (and
  // documented) for the /jobs page's own removed heading: this page no
  // longer has a landmark <h1> of its own. `pageTitle`/`pageDescription`
  // (generateMetadata, above) are untouched: the browser tab title and
  // share-card copy still describe the page for anyone who isn't looking
  // at it, including search engines and link previews.
  return <AssistantChat initialQuery={q} />;
}
