import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

/** Employers land on My job ads (§7.2). Tabs per §7.2: Active / Inactive / Drafts. */
export default async function MyJobAdsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const tabs = ["tabActive", "tabInactive", "tabDrafts"] as const;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("myJobAds")}</h1>
        <button
          type="button"
          className="h-9 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90"
        >
          {t("addJobAd")}
        </button>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab, i) => (
          <span
            key={tab}
            className={
              i === 0
                ? "-mb-px shrink-0 border-b-2 border-pine px-3 py-2 text-sm font-medium whitespace-nowrap text-ink"
                : "shrink-0 px-3 py-2 text-sm whitespace-nowrap text-muted"
            }
          >
            {t(tab)}
          </span>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">{t("empty")}</p>
    </>
  );
}
