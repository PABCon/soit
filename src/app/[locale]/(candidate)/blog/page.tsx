import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localeAlternates, socialMeta } from "@/lib/seo";
import { getAllBlogPostsMeta } from "@/lib/blog";
import { BlogListing } from "@/components/blog/BlogListing";

type Props = { params: Promise<{ locale: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "hello@justit.pt";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const title = t("listingTitle");
  const description = t("listingDescription");
  return {
    title,
    description,
    alternates: localeAlternates("/blog", locale),
    ...socialMeta({ title, description, url: `${SITE}/${locale}/blog` }),
  };
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "blog" });
  const posts = getAllBlogPostsMeta(locale);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid items-center gap-8 rounded-2xl bg-pine/5 p-8 sm:p-10 lg:grid-cols-[1fr_280px]">
        <div>
          <p className="text-sm font-semibold text-pine">{t("listingLabel")}</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{t("listingHeading")}</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">{t("listingIntro")}</p>
        </div>
        {/* Robot illustration — the current source PNG's own dark glow
         *  background is baked into its pixels (not real transparency; a
         *  luminance-threshold removal attempt confirmed there's no clean
         *  way to cut it out automatically), so it's framed in a matching
         *  dark card rather than floating directly on this light section
         *  the way the original design calls for. Swap this card out for
         *  a plain `object-contain` image the moment a transparent-
         *  background version exists. */}
        <div className="relative mx-auto aspect-square w-[200px] overflow-hidden rounded-2xl bg-slate-900 sm:w-[240px]">
          <Image src="/blog/robot-hero.png" alt="" fill sizes="240px" className="object-cover" priority />
        </div>
      </div>

      <div className="mt-10">
        <BlogListing posts={posts} locale={locale} />
      </div>

      <div className="mt-14 flex flex-col items-center gap-4 rounded-2xl bg-pine/5 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{t("shareStoryHeading")}</h2>
          <p className="mt-1 max-w-md text-sm text-muted">{t("shareStoryBody")}</p>
        </div>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Blog — topic/guest post")}`}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine-hover"
        >
          {t("shareStoryCta")}
        </a>
      </div>
    </div>
  );
}
