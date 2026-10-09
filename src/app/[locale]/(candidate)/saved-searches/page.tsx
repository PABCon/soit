import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMySavedSearches, savedSearchHref } from "@/lib/db/saved-searches";
import { Link } from "@/i18n/navigation";
import { DeleteSavedSearchButton } from "@/components/DeleteSavedSearchButton";
import { SavedSearchNotifyToggle } from "@/components/SavedSearchNotifyToggle";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "savedSearches" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Saved searches (§7.1, real-usage QA round 3 phase 5) — save/manage
 *  only, no email delivery yet (no real sender or scheduled-job infra
 *  exists in this project; see CLAUDE.md). Same shell as /applications
 *  and /favorites. */
export default async function SavedSearchesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "savedSearches" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/candidate/login", locale });

  const searches = await getMySavedSearches();

  return (
    <>
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {searches.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {searches.map((s) => (
            <li key={s.id} className="flex items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <Link
                  href={savedSearchHref(s.query)}
                  className="font-medium text-ink hover:text-pine hover:underline"
                >
                  {s.label}
                </Link>
              </div>
              <SavedSearchNotifyToggle id={s.id} initialOptIn={s.notifyOptIn} />
              <DeleteSavedSearchButton id={s.id} label={t("delete")} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
